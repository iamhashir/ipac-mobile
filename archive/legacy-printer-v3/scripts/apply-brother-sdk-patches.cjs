const fs = require('fs');
const path = require('path');

function applyPatchFromTemplate(rootDir, templateRelPath, targetRelPath) {
  const templatePath = path.join(rootDir, templateRelPath);
  const targetPath = path.join(rootDir, targetRelPath);

  if (!fs.existsSync(templatePath)) {
    console.warn(`[brother-sdk-patch] Template missing: ${templateRelPath}`);
    return;
  }

  if (!fs.existsSync(targetPath)) {
    console.warn(`[brother-sdk-patch] Target missing (skip): ${targetRelPath}`);
    return;
  }

  const template = fs.readFileSync(templatePath, 'utf8');
  const current = fs.readFileSync(targetPath, 'utf8');

  if (current === template) {
    console.log(`[brother-sdk-patch] Already patched: ${targetRelPath}`);
    return;
  }

  fs.writeFileSync(targetPath, template, 'utf8');
  console.log(`[brother-sdk-patch] Patched: ${targetRelPath}`);
}

function main() {
  const rootDir = path.resolve(__dirname, '..');

  const patches = [
    {
      template: 'scripts/brother-sdk-patches/SettingsUtils.android.kt',
      target: 'node_modules/expo-brother-printer-sdk/android/src/main/java/com/vpass/brotherprintersdk/SettingsUtils.kt',
    },
    {
      template: 'scripts/brother-sdk-patches/SettingsUtils.ios.swift',
      target: 'node_modules/expo-brother-printer-sdk/ios/SettingsUtils.swift',
    },
  ];

  for (const patch of patches) {
    applyPatchFromTemplate(rootDir, patch.template, patch.target);
  }
}

main();
