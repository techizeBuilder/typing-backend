// Launcher for the compiled restore command (works whichever folder layout the
// build produced). Run with: npm run backup:restore -- <file.zip> --confirm <DB_NAME>
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const target = ['dist/src/scripts/restore-backup.js', 'dist/scripts/restore-backup.js']
  .map((p) => path.join(root, p))
  .find((p) => fs.existsSync(p));
if (!target) {
  console.error('Build the backend first: npm run build');
  process.exit(1);
}
process.chdir(root);
try { require('dotenv').config({ path: path.join(root, '.env') }); } catch { /* env already set */ }
require(target);
