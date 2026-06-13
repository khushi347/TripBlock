import fs from 'fs';
import path from 'path';

const srcDir = 'c:/Users/dishika more/OneDrive/ドキュメント/Desktop/trip frontend';
const destDir = 'c:/Users/dishika more/OneDrive/ドキュメント/Desktop/frontend tripblock';

function copyFile(srcName, destName) {
  const srcPath = path.join(srcDir, srcName);
  const destPath = path.join(destDir, destName);
  
  try {
    fs.copyFileSync(srcPath, destPath);
    console.log(`Successfully copied ${srcName} to ${destName}`);
  } catch (err) {
    console.error(`Error copying ${srcName}:`, err);
  }
}

copyFile('src/App.jsx', 'src/App.jsx');
copyFile('demo-standalone.html', 'demo-standalone.html');
