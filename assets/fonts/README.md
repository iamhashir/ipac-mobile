# Custom Fonts

This folder is where you can place your Calibri font files if you want consistent rendering across iOS/Android and Web.

Add the following files (if you are licensed to distribute/use Calibri in your app):
- Calibri-Regular.ttf
- Calibri-Bold.ttf
- Calibri-Italic.ttf
- Calibri-BoldItalic.ttf

Notes:
- After adding these files, you can optionally update the app to load them using expo-font for perfect consistency across all platforms.
- Without the files, the app will still request the `Calibri` family, and devices that have it installed (e.g., many Windows environments) will show it; others will gracefully fall back to the system font.

Optional (if you want bundled fonts):
- Install expo-font: npm i expo-font
- Load fonts in a root layout using `useFonts` and set `fontFamily: 'Calibri'` globally.
- If you want correct bold/italic on Android, load each variant and apply the matching `fontFamily` for bold/italic where needed.
