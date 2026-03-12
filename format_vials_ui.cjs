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

      // 1. Update select queries: (name, capacity_ml) -> (name, capacity_ml, color, shape)
      if (content.includes('capacity_ml)')) {
        content = content.replace(/(vial_types|vial_type_id)\s*\(\s*name\s*,\s*capacity_ml\s*\)/g, '$1(name, capacity_ml, color, shape)');
        content = content.replace(/(vial_types|vial_type_id)!\w+\(\s*name\s*,\s*capacity_ml\s*\)/g, (match) => {
           return match.replace(/capacity_ml\s*\)/, 'capacity_ml, color, shape)');
        });
        changed = true;
      }

      // 2. Add color and shape to UI where it displays capacity_ml}ml or capacity_ml} ml
      // e.g. {variant.vial_type.capacity_ml}ml -> {variant.vial_type.capacity_ml}ml{variant.vial_type.color ? ` - ${variant.vial_type.color}` : ''}{variant.vial_type.shape ? ` - ${variant.vial_type.shape}` : ''}
      // This regex captures the variable prefix before capacity_ml
      const uiRegex = /\{([^}]*?\.?)capacity_ml\}\s*ml/g;
      
      // Before replacing, test if we have any matches
      if (uiRegex.test(content)) {
        content = content.replace(uiRegex, (match, prefix) => {
          // prefix is like `variant.vial_type.` or `item.variant?.vial_type?.` or `vt.`
          const color = prefix + "color";
          const shape = prefix + "shape";
          return `{${prefix}capacity_ml}ml{${color} ? \` - \${${color}}\` : ''}{${shape} ? \` - \${${shape}}\` : ''}`;
        });
        changed = true;
      }

      // 3. For ManageVialTypesDialog.tsx it will ruin the table headers and body, wait!
      // I should skip ManageVialTypesDialog.tsx since I already manually edited it.
      if (filepath.endsWith('ManageVialTypesDialog.tsx')) {
        changed = false; // We already handled it
      }

      if (filepath.endsWith('types.ts')) {
        changed = false; // types.ts doesn't need this
      }

      if (changed) {
        fs.writeFileSync(filepath, content, 'utf8');
        console.log(`Updated select queries and UI in ${filepath}`);
      }
    });
  }
});
