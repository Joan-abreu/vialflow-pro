const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdir(dir, (err, files) => {
    if (err) throw err;
    files.forEach(file => {
      const filepath = path.join(dir, file);
      fs.stat(filepath, (err, stats) => {
        if (stats.isDirectory()) {
          walk(filepath, callback);
        } else if (stats.isFile() && (filepath.endsWith('.ts') || filepath.endsWith('.tsx'))) {
          callback(filepath);
        }
      });
    });
  });
}

const directoriesToSearch = [
  path.join(__dirname, 'src'),
  path.join(__dirname, 'supabase', 'functions')
];

directoriesToSearch.forEach(dir => {
  walk(dir, (filepath) => {
    let content = fs.readFileSync(filepath, 'utf8');
    let changed = false;

    // Pattern to find literal $ before { that contain color or shape logic
    // We want to avoid matching inside backticks (template literals)
    // However, in JSX, it's usually ...ml${...}
    
    // First, specifically target ml$
    if (content.includes('ml$')) {
        content = content.replace(/ml\$/g, 'ml');
        changed = true;
    }

    // Second, target any $ immediately before a { that looks like our color/shape injection
    const pattern = /\$({[^}]*?(color|shape)\s*\?\s*` - \${[^}]*?(color|shape)}`\s*:\s*''})/g;
    if (pattern.test(content)) {
        content = content.replace(pattern, '$1');
        changed = true;
    }

    if (changed) {
      fs.writeFileSync(filepath, content, 'utf8');
      console.log(`Removed extra dollars in ${filepath}`);
    }
  });
});
