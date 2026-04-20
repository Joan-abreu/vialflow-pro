<#
.SYNOPSIS
    Comprenhesive Supabase Backup Script (DOCKER-FREE VERSION)
    Backs up Database, Storage (via API), Secrets, and Local Config.
#>

$ProjectID = "gtmpqjbbcobjxwfeyqzz"
$BaseUrl = "https://gtmpqjbbcobjxwfeyqzz.supabase.co"
$PoolerHost = "aws-1-us-east-1.pooler.supabase.com"
$PoolerPort = "6543"
$DBUser = "postgres.$ProjectID"
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupDir = Join-Path $PSScriptRoot "backups\BCK-$Timestamp"
$StorageDir = Join-Path $BackupDir "storage"

# Create directories
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
New-Item -ItemType Directory -Force -Path $StorageDir | Out-Null

Write-Host "--- Starting Supabase Full Backup ($Timestamp) [NO DOCKER] ---" -ForegroundColor Cyan

# 1. Database Backup (Multi-Phase via pg_dump)
Write-Host "[1/5] Dumping Database (Schema & Data)..." -ForegroundColor Yellow
$DBPassword = Read-Host "Enter your Supabase Database Password"
$EscapedPassword = [uri]::EscapeDataString($DBPassword)
$DBUrl = "postgresql://$($DBUser):$($EscapedPassword)@$($PoolerHost):$($PoolerPort)/postgres"

$SchemaFile = Join-Path $BackupDir "schema.sql"
$DataFile = Join-Path $BackupDir "data.sql"

try {
    # Phase A: Schema (PUBLIC ONLY, NO OWNER/PRIVS)
    Write-Host "  -> Dumping Schema (public)..." -ForegroundColor Gray
    # Using 2>&1 to capture possible errors
    & pg_dump -s -n public --no-owner --no-privileges $DBUrl -f $SchemaFile 2>&1 | Out-Default
    
    # Phase B: Data (PUBLIC ONLY, NO OWNER/PRIVS)
    Write-Host "  -> Dumping Data (public)..." -ForegroundColor Gray
    $TempData = Join-Path $BackupDir "data_raw.sql"
    
    # We remove the storage. exclusions because -n public already ignores other schemas
    & pg_dump -a -n public --no-owner --no-privileges --column-inserts $DBUrl -f $TempData 2>&1 | Out-Default
    
    if (Test-Path $TempData) {
        # Prepend the session_replication_role header carefully in UTF8
        $DataHeader = "SET session_replication_role = 'replica';`r`n`r`n"
        $DataContent = Get-Content -Path $TempData -Raw
        $FullDataContent = $DataHeader + $DataContent
        $FullDataContent | Out-File -FilePath $DataFile -Encoding utf8
        Remove-Item $TempData
        Write-Host "  Success: Database (public schema) dumped." -ForegroundColor Green
    } else {
        Write-Warning "  Warning: Data file 'data_raw.sql' was not created by pg_dump."
    }
} catch {
    Write-Host "  Error in Database Dump section: $($_.Exception.Message)" -ForegroundColor Red
}

# 2. Extract Keys & Export Secrets
Write-Host "[2/5] Exporting Remote Secrets & Keys..." -ForegroundColor Yellow
$SecretsFile = Join-Path $BackupDir "secrets.json"
$ServiceRoleKey = ""

try {
    $SecretsJson = supabase secrets list --output json 2>$null
    if ($LASTEXITCODE -eq 0) {
        $SecretsJson | Out-File -FilePath $SecretsFile
        $SecretsObj = $SecretsJson | ConvertFrom-Json
        $ServiceRoleKey = ($SecretsObj | Where-Object { $_.name -eq "SUPABASE_SERVICE_ROLE_KEY" }).value
        Write-Host "  Success: Secrets and Keys acquired via CLI." -ForegroundColor Green
    } else {
        throw "CLI failed to fetch secrets."
    }
} catch {
    Write-Host "  Could not export secrets automatically." -ForegroundColor Gray
    Write-Host "  To backup Storage and Functions, we need the SERVICE_ROLE_KEY." -ForegroundColor Gray
    $ServiceRoleKey = Read-Host "Please paste your 'service_role' key (Settings -> API)"
    if ($ServiceRoleKey) {
        # Create a manual secrets file for the backup
        $ManualSecret = @(@{name="SUPABASE_SERVICE_ROLE_KEY"; value=$ServiceRoleKey}) | ConvertTo-Json
        $ManualSecret | Out-File -FilePath $SecretsFile
    }
}

# 3. Storage Backup (via REST API - Recursive)
Write-Host "[3/5] Downloading Storage Buckets via API..." -ForegroundColor Yellow

function Download-BucketFolder($BucketId, $PathPrefix, $LocalPath) {
    if (-not (Test-Path $LocalPath)) { New-Item -ItemType Directory -Force -Path $LocalPath | Out-Null }

    $Body = @{
        prefix = $PathPrefix
        limit = 100
        offset = 0
        sortBy = @{ column = "name"; order = "asc" }
    } | ConvertTo-Json

    $Headers = @{
        "Authorization" = "Bearer $ServiceRoleKey"
        "apikey" = $ServiceRoleKey
        "Content-Type" = "application/json"
    }

    try {
        $Objects = Invoke-RestMethod -Uri "$BaseUrl/storage/v1/object/list/$BucketId" -Method Post -Headers $Headers -Body $Body
        
        foreach ($Obj in $Objects) {
            $SafeName = $Obj.name
            if ($Obj.id -eq $null) {
                # This is a folder. The API for listing folders returns objects without IDs.
                # However, listing with prefix often returns nested objects directly depending on the depth.
                # If name ends with / or has no ID, it's often metadata or a folder.
                continue
            }
            
            # If metadata says it's a folder, recurse (Supabase Storage API returns folders as items without metadata in list)
            # Actually, the 'list' command returns everything in the prefix.
            # We filter for objects (files) vs folders.
            
            if ($Obj.metadata -eq $null) {
                # Likely a sub-folder
                $SubPath = if ([string]::IsNullOrEmpty($PathPrefix)) { $Obj.name } else { "$PathPrefix/$($Obj.name)" }
                Download-BucketFolder -BucketId $BucketId -PathPrefix "$SubPath/" -LocalPath (Join-Path $LocalPath $Obj.name)
            } else {
                # It's a file
                $FilePath = if ([string]::IsNullOrEmpty($PathPrefix)) { $Obj.name } else { "$PathPrefix/$($Obj.name)" }
                $LocalFilePath = Join-Path $LocalPath $Obj.name
                
                Write-Host "    -> Downloading: $FilePath" -ForegroundColor Gray
                Invoke-RestMethod -Uri "$BaseUrl/storage/v1/object/$BucketId/$FilePath" -Method Get -Headers $Headers -OutFile $LocalFilePath
            }
        }
    } catch {
        Write-Host "    Error listing/downloading folder '$PathPrefix': $($_.Exception.Message)" -ForegroundColor Red
    }
}

try {
    $ListHeaders = @{ "Authorization" = "Bearer $ServiceRoleKey"; "apikey" = $ServiceRoleKey }
    $Buckets = Invoke-RestMethod -Uri "$BaseUrl/storage/v1/bucket" -Method Get -Headers $ListHeaders
    
    foreach ($Bucket in $Buckets) {
        Write-Host "  -> Syncing bucket: $($Bucket.name)" -ForegroundColor Cyan
        $BucketDir = Join-Path $StorageDir $Bucket.name
        Download-BucketFolder -BucketId $Bucket.id -PathPrefix "" -LocalPath $BucketDir
    }
    Write-Host "  Success: Storage download complete." -ForegroundColor Green
} catch {
    Write-Host "  Error syncing storage: $($_.Exception.Message)" -ForegroundColor Red
}

# 4. Local Config Snapshot
Write-Host "[4/5] Snapshotting local Supabase config..." -ForegroundColor Yellow
$LocalSupabase = Join-Path $PSScriptRoot "supabase"
$BackupSupabase = Join-Path $BackupDir "supabase_config"

if (Test-Path $LocalSupabase) {
    Copy-Item -Path $LocalSupabase -Destination $BackupSupabase -Recurse -Force
    Write-Host "  Success: Config copied." -ForegroundColor Green
}

# 5. Compression
Write-Host "[5/5] Compressing backup into ZIP..." -ForegroundColor Yellow
$ZipPath = Join-Path $PSScriptRoot "backups\VialFlow_Backup_$Timestamp.zip"
try {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::CreateFromDirectory($BackupDir, $ZipPath)
    Write-Host "--- BACKUP COMPLETE ---" -ForegroundColor Cyan
    Write-Host "File: $ZipPath" -ForegroundColor Cyan
} catch {
    Write-Host "  Failed to create ZIP, but files are in $BackupDir" -ForegroundColor Red
}
