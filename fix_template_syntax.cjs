const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
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
  if (fs.existsSync(dir)) {
    walk(dir, (filepath) => {
      let content = fs.readFileSync(filepath, 'utf8');
      let changed = false;

      // Find the pattern {prefix.color ? ...} and replace with ${prefix.color ? ...}
      // But only if it's NOT preceded by $
      const pattern = /([^\$])({[^}]*?color\s*\?\s*` - \${[^}]*?color}`\s*:\s*''})/g;
      if (pattern.test(content)) {
        content = content.replace(pattern, '$1$$$2');
        changed = true;
      }

      // Also for shape
      const patternShape = /([^\$])({[^}]*?shape\s*\?\s*` - \${[^}]*?shape}`\s*:\s*''})/g;
      if (patternShape.test(content)) {
        content = content.replace(patternShape, '$1$$$2');
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(filepath, content, 'utf8');
        console.log(`Fixed template syntax in ${filepath}`);
      }
    });
  }
});
