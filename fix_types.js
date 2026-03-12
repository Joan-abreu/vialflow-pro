const fs = require('fs');
const path = require('path');

const filepath = path.join(__dirname, 'src', 'integrations', 'supabase', 'types.ts');
let content = fs.readFileSync(filepath, 'utf16le');

// Replace size_ml with capacity_ml and add color and shape
content = content.replace(/size_ml: number(\s*)/g, 'capacity_ml: number$1          color?: string | null\n          shape?: string | null$1');
content = content.replace(/size_ml\?: number(\s*)/g, 'capacity_ml?: number$1          color?: string | null\n          shape?: string | null$1');

fs.writeFileSync(filepath, content, 'utf8');
console.log('types.ts updated and converted to utf8');
