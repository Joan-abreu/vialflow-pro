const fs = require('fs');
const path = require('path');

const filepath = path.join(__dirname, 'src', 'integrations', 'supabase', 'types.ts');
let content = fs.readFileSync(filepath, 'utf16le');

// Read the UTF16LE file, replace what's needed, and write back as UTF8 so it's easier to read/write normally
content = content.replace(/size_ml: number(\n|\r\n|\s*)/g, 'capacity_ml: number$1          color?: string | null$1          shape?: string | null$1');
content = content.replace(/size_ml\?: number(\n|\r\n|\s*)/g, 'capacity_ml?: number$1          color?: string | null$1          shape?: string | null$1');

fs.writeFileSync(filepath, content, 'utf8');
console.log('types.ts updated and converted to utf8');
