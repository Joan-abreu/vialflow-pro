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
      const content = fs.readFileSync(filepath, 'utf8');
      if (content.includes('size_ml')) {
        const newContent = content.replace(/size_ml/g, 'capacity_ml');
        fs.writeFileSync(filepath, newContent, 'utf8');
        console.log(`Replaced in ${filepath}`);
      }
    });
  }
});
