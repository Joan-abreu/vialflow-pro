<#
.SYNOPSIS
    Comprehensive Supabase Restore Script (DOCKER-FREE VERSION - V3)
    Restores Database (psql), Storage (API creation + upload), and Secrets.
#>

Write-Host "--- Supabase Full Restore Tool [V3 - Resilience Update] ---" -ForegroundColor Cyan

# 1. Target Configuration
$TargetProjectID = Read-Host "Enter the Target Project Reference ID"
$TargetDBPassword = Read-Host "Enter the Target Database Password" -AsSecureString
$TargetServiceRoleKey = Read-Host "Enter the Target SERVICE_ROLE_KEY (Settings -> API)"
$TargetPoolerHost = Read-Host "Enter Target Pooler Host (e.g., aws-1-us-east-2.pooler.supabase.com)"
$TargetPoolerPort = "6543"
$TargetApiUrl = "https://$TargetProjectID.supabase.co"

# Headers for API calls
$TargetHeaders = @{
    "Authorization" = "Bearer $TargetServiceRoleKey"
    "apikey" = $TargetServiceRoleKey
    "Content-Type" = "application/json"
}

# Convert SecureString to plain text
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($TargetDBPassword)
$PlainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
$EscapedPassword = [uri]::EscapeDataString($PlainPassword)
$DBUrl = "postgresql://$("postgres.$TargetProjectID"):$($EscapedPassword)@$($TargetPoolerHost):$($TargetPoolerPort)/postgres"

# 2. Select Backup
$BackupsDir = Join-Path $PSScriptRoot "backups"
$AllBackups = Get-ChildItem -Path $BackupsDir -Directory | Sort-Object LastWriteTime -Descending
if ($AllBackups.Count -eq 0) { Write-Error "No backups found."; exit }

Write-Host "`nAvailable Backups:" -ForegroundColor Gray
for ($i=0; $i -lt $AllBackups.Count; $i++) { Write-Host "  [$i] $($AllBackups[$i].Name)" }
$Choice = Read-Host "`nSelect backup index (default 0)"
if ([string]::IsNullOrWhiteSpace($Choice)) { $Choice = 0 }
$BackupPath = $AllBackups[[int]$Choice].FullName

Write-Host "`n--- Restoring from $($AllBackups[[int]$Choice].Name) ---" -ForegroundColor Cyan

# 3. Database Restore
Write-Host "[1/4] Restoring Database (Schema -> Data)..." -ForegroundColor Yellow
$SchemaFile = Join-Path $BackupPath "schema.sql"
$DataFile = Join-Path $BackupPath "data.sql"

if (Test-Path $SchemaFile) {
    Write-Host "  -> Preparing Schema (cleaning public schema calls)..." -ForegroundColor Gray
    # Remove 'CREATE SCHEMA public' to avoid conflicts
    $CleanSchema = Get-Content $SchemaFile | Where-Object { $_ -notmatch "CREATE SCHEMA public;" -and $_ -notmatch "ALTER SCHEMA public OWNER TO" }
    $CleanSchema | Out-File -FilePath "$SchemaFile.clean" -Encoding utf8
    
    Write-Host "  -> Applying Schema..." -ForegroundColor Gray
    & psql $DBUrl -f "$SchemaFile.clean" 2>"$BackupPath\restore_schema_errors.log"
}
if (Test-Path $DataFile) {
    Write-Host "  -> Applying Data..." -ForegroundColor Gray
    & psql $DBUrl -f $DataFile 2>"$BackupPath\restore_data_errors.log"
}
Write-Host "  Success: Database restoration completed." -ForegroundColor Green

# 4. Secrets Restore
Write-Host "[2/4] Restoring Secrets..." -ForegroundColor Yellow
$SecretsFile = Join-Path $BackupPath "secrets.json"

if (Test-Path $SecretsFile) {
    $Secrets = Get-Content $SecretsFile | ConvertFrom-Json
    foreach ($S in $Secrets) {
        if ($S.name -like "SUPABASE_*") { continue }
        Write-Host "  -> Setting $($S.name)..." -ForegroundColor Gray
        supabase secrets set "$($S.name)=$($S.value)" --project-ref $TargetProjectID | Out-Null
    }
    Write-Host "  Success: Secrets applied." -ForegroundColor Green
}

# 5. Storage Restore (API)
Write-Host "[3/4] Restoring Storage Buckets & Files..." -ForegroundColor Yellow

function Create-Bucket($BucketId) {
    Write-Host "  -> Verifying bucket: $BucketId" -ForegroundColor Gray
    try {
        # Check if exists
        Invoke-RestMethod -Uri "$TargetApiUrl/storage/v1/bucket/$BucketId" -Method Get -Headers $TargetHeaders | Out-Null
    } catch {
        Write-Host "     Bucket not found. Creating: $BucketId" -ForegroundColor Gray
        $Body = @{ id = $BucketId; name = $BucketId; public = $true } | ConvertTo-Json
        Invoke-RestMethod -Uri "$TargetApiUrl/storage/v1/bucket" -Method Post -Headers $TargetHeaders -Body $Body | Out-Null
    }
}

function Upload-File($BucketId, $LocalFilePath, $RemotePath) {
    # Headers for file upload (must NOT have Content-Type: application/json)
    $UploadHeaders = @{
        "Authorization" = "Bearer $TargetServiceRoleKey"
        "apikey" = $TargetServiceRoleKey
    }
    
    $FileBytes = [System.IO.File]::ReadAllBytes($LocalFilePath)
    $ContentType = "application/octet-stream"
    if ($LocalFilePath -match "\.png$") { $ContentType = "image/png" }
    elseif ($LocalFilePath -match "\.jpg$|\.jpeg$") { $ContentType = "image/jpeg" }

    try {
        Invoke-RestMethod -Uri "$TargetApiUrl/storage/v1/object/$BucketId/$RemotePath" `
                          -Method Post `
                          -Headers $UploadHeaders `
                          -Body $FileBytes `
                          -ContentType $ContentType | Out-Null
        Write-Host "    Uploaded: $RemotePath" -ForegroundColor Gray
    } catch {
        if ($_.Exception.Message -match "409") {
            Write-Host "    Exists: $RemotePath (skipped)" -ForegroundColor DarkGray
        } else {
            Write-Host "    Failed: $RemotePath ($($_.Exception.Message))" -ForegroundColor Red
        }
    }
}

function Process-Storage-Folder($BucketId, $LocalFolderPath, $RemotePrefix) {
    $Items = Get-ChildItem -Path $LocalFolderPath
    foreach ($Item in $Items) {
        $RemoteName = if ([string]::IsNullOrEmpty($RemotePrefix)) { $Item.Name } else { "$RemotePrefix/$($Item.Name)" }
        if ($Item.PSIsContainer) {
            Process-Storage-Folder -BucketId $BucketId -LocalFolderPath $Item.FullName -RemotePrefix $RemoteName
        } else {
            Upload-File -BucketId $BucketId -LocalFilePath $Item.FullName -RemotePath $RemoteName
        }
    }
}

$StorageDir = Join-Path $BackupPath "storage"
if (Test-Path $StorageDir) {
    $Buckets = Get-ChildItem -Path $StorageDir -Directory
    foreach ($B in $Buckets) {
        Write-Host "  -> Syncing bucket: $($B.Name)" -ForegroundColor Cyan
        Create-Bucket -BucketId $B.Name
        Process-Storage-Folder -BucketId $B.Name -LocalFolderPath $B.FullName -RemotePrefix ""
    }
    Write-Host "  Success: Storage restoration complete." -ForegroundColor Green
}

Write-Host "`n--- RESTORE PROCESS FINISHED ---" -ForegroundColor Cyan
Write-Host "Tip: Deploy Edge Functions manually and update your VITE_SUPABASE_URL in Vercel if needed." -ForegroundColor Gray
