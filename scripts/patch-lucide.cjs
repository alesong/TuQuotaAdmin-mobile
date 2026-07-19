const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '..', 'node_modules', 'lucide-react-native', 'package.json');

try {
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    let changed = false;

    if (pkg['react-native'] !== 'dist/cjs/lucide-react-native.js') {
      pkg['react-native'] = 'dist/cjs/lucide-react-native.js';
      changed = true;
    }

    if (pkg.exports) {
      delete pkg.exports;
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
      console.log('Patched lucide-react-native to use CJS and removed exports map');
    }
  } else {
    console.log('lucide-react-native package.json not found, skipping patch');
  }
} catch (error) {
  console.error('Failed to patch lucide-react-native:', error.message);
}