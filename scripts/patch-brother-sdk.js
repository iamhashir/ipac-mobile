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

// 4. Patch ReadableMapUtils.kt — fix Kotlin null-safety compile errors
const ktPath = path.join(__dirname, '..', 'node_modules', 'official-react-brother-print-sdk', 'android', 'src', 'main', 'java', 'com', 'brother', 'bms', 'rtnbrotherprintsdk', 'model', 'ReadableMapUtils.kt');
if (fs.existsSync(ktPath)) {
  let ktContent = fs.readFileSync(ktPath, 'utf8');
  
  // Apply fix if not already patched
  if (!ktContent.includes('getMap(i)?.toJson()')) {
    ktContent = ktContent.replace(
      /ReadableType\.Map\s*->\s*getMap\(i\)\.toJson\(\)/g,
      'ReadableType.Map -> getMap(i)?.toJson() ?: JsonNull.INSTANCE'
    );
    ktContent = ktContent.replace(
      /ReadableType\.Array\s*->\s*getArray\(i\)\.toJson\(\)/g,
      'ReadableType.Array -> getArray(i)?.toJson() ?: JsonNull.INSTANCE'
    );
    fs.writeFileSync(ktPath, ktContent);
    console.log('✓ Patched ReadableMapUtils.kt');
  } else {
    console.log('✓ ReadableMapUtils.kt is already patched');
  }
}

// 5. Patch V4SdkConnector.kt — inject PT label size bypass for newer printer support
const v4Path = path.join(__dirname, '..', 'node_modules', 'official-react-brother-print-sdk', 'android', 'src', 'main', 'java', 'com', 'brother', 'bms', 'rtnbrotherprintsdk', 'sdkconnector', 'V4SdkConnector.kt');
if (fs.existsSync(v4Path)) {
  let v4Content = fs.readFileSync(v4Path, 'utf8');

  if (!v4Content.includes('EMERGENCY NATIVE PATCH')) {
    const anchor = 'Setters.resetPropertiesNotUpdated()\n            val propertiesNotUpdated';
    const replacement = `Setters.resetPropertiesNotUpdated()

            // EMERGENCY NATIVE PATCH: Bypass missing PTSetters map
            if (it is com.brother.sdk.lmprinter.setting.PTPrintSettings) {
                if (newSettings.hasKey("emulatePtLabelSize")) {
                    try {
                        val labelStr = newSettings.getString("emulatePtLabelSize")!!
                        it.labelSize = com.brother.sdk.lmprinter.setting.PTPrintSettings.LabelSize.valueOf(labelStr)
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            }

            val propertiesNotUpdated`;

    if (v4Content.includes(anchor)) {
      v4Content = v4Content.replace(anchor, replacement);
      fs.writeFileSync(v4Path, v4Content);
      console.log('✓ Patched V4SdkConnector.kt');
    } else {
      console.warn('⚠ V4SdkConnector.kt: anchor string not found — patch skipped. Manual review needed.');
    }
  } else {
    console.log('✓ V4SdkConnector.kt is already patched');
  }
}

// 6. Keep the vendor AAR out of the library AAR. AGP rejects direct local AAR
// dependencies on library projects because they cannot be embedded correctly.
// The application adds this AAR directly in android/app/build.gradle instead.
const sdkGradlePath = path.join(__dirname, '..', 'node_modules', 'official-react-brother-print-sdk', 'android', 'build.gradle');
if (fs.existsSync(sdkGradlePath)) {
  let sdkGradle = fs.readFileSync(sdkGradlePath, 'utf8');
  const localAarDependency = 'implementation(files("libs/BrotherPrintLibrary_4120.aar"))';
  if (sdkGradle.includes(localAarDependency)) {
    sdkGradle = sdkGradle.replace(localAarDependency, 'compileOnly(files("libs/BrotherPrintLibrary_4120.aar"))');
    fs.writeFileSync(sdkGradlePath, sdkGradle);
    console.log('✓ Patched Brother SDK AAR dependency for AGP library bundling');
  } else if (sdkGradle.includes('compileOnly(files("libs/BrotherPrintLibrary_4120.aar"))')) {
    console.log('✓ Brother SDK AAR dependency is already patched');
  } else {
    console.warn('⚠ Brother SDK AAR dependency not found — manual review needed.');
  }
}

console.log('✓ All patches applied successfully');
