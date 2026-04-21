const fs = require('fs');
const path = require('path');

const base = path.join(__dirname, '..', 'node_modules', 'official-react-brother-print-sdk', 'generated', 'android', 'jni');

// 1. Patch CMakeLists.txt
const cmakePath = path.join(base, 'CMakeLists.txt');
let cmake = fs.readFileSync(cmakePath, 'utf8');

if (!cmake.includes('find_package(ReactAndroid')) {
  cmake = cmake.replace(
    'cmake_minimum_required(VERSION 3.13)',
    'cmake_minimum_required(VERSION 3.13)\nfind_package(ReactAndroid REQUIRED CONFIG)'
  );
}

// Replace the ENTIRE target_link_libraries block — all those raw libs no longer
// exist separately in RN 0.81; they're all bundled inside libreactnative.so
cmake = cmake.replace(
  /target_link_libraries\(\s*react_codegen_RTNBrotherPrintSDKSpec[\s\S]*?\)/,
  `target_link_libraries(
  react_codegen_RTNBrotherPrintSDKSpec
  ReactAndroid::reactnative
  ReactAndroid::jsi
  fbjni
)`
);

fs.writeFileSync(cmakePath, cmake);
console.log('✓ Patched CMakeLists.txt');

// 2. Patch RTNBrotherPrintSDKSpec.h — revert wrong path back to correct ReactCommon path
const specHPath = path.join(base, 'RTNBrotherPrintSDKSpec.h');
let specH = fs.readFileSync(specHPath, 'utf8');
specH = specH.replace(
  '#include <react/nativemodule/core/TurboModule.h>',
  '#include <ReactCommon/TurboModule.h>'
);
fs.writeFileSync(specHPath, specH);
console.log('✓ Patched RTNBrotherPrintSDKSpec.h');

// 3. Patch RTNBrotherPrintSDKSpecJSI.h — same wrong path, same fix
const jsiHPath = path.join(base, 'react', 'renderer', 'components', 'RTNBrotherPrintSDKSpec', 'RTNBrotherPrintSDKSpecJSI.h');
let jsiH = fs.readFileSync(jsiHPath, 'utf8');
jsiH = jsiH.replace(
  '#include <react/nativemodule/core/TurboModule.h>',
  '#include <ReactCommon/TurboModule.h>'
);
fs.writeFileSync(jsiHPath, jsiH);
console.log('✓ Patched RTNBrotherPrintSDKSpecJSI.h');

console.log('✓ All patches applied successfully');