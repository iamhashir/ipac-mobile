const fs = require('fs');
const p = 'd:/IPAC_PROD/ipac-operations-app-main/utils/printing/brotherDirectPrint.ts';
let t = fs.readFileSync(p, 'utf8');

t = t.replace(
  /  <\/html>`;\s*};\s*const buildTextHtml/m,
  "  </html>\`,\n    widthPoints: tapePx / 5,\n    heightPoints: pageLengthPx / 5\n  };\n};\n\nconst buildTextHtml"
);

t = t.replace(
  /  <\/html>`;\s*\};\s*const printHtmlWithBrother = async \(html: string,/m,
  "  </html>\`,\n    widthPoints: widthPx / 5,\n    heightPoints: minHeightPx / 5\n  };\n};\n\nconst printHtmlWithBrother = async (html: string, widthPoints?: number, heightPoints?: number,"
);

t = t.replace(
  /const printHtmlWithBrother = async \(html: string, options: BrotherDirectPrintOptions = \{\}\) => \{/,
  "const printHtmlWithBrother = async (html: string, widthPoints?: number, heightPoints?: number, options: BrotherDirectPrintOptions = {}) => {"
);

t = t.replace(
  /const buildTextHtml = \(textValue: string, options: BrotherDirectPrintOptions\) => \{[\s\S]*?return `<!DOCTYPE html>/,
  "const buildTextHtml = (textValue: string, options: BrotherDirectPrintOptions) => {\n  const Math = globalThis.Math;\n  const labelWidthMm = resolveLabelWidthMm(options.labelWidthMm);\n  const widthPx = Math.max(170, Math.round((labelWidthMm / 25.4) * 360));\n  const safeText = escapeHtml(textValue);\n  const minHeightPx = Math.round(widthPx * 1.1);\n\n  return {\n    html: `<!DOCTYPE html>"
);

t = t.replace(
  /await printHtmlWithBrother\(html, options\);/,
  "await printHtmlWithBrother(html.html || html, html.widthPoints, html.heightPoints, options);"
);

t = t.replace(
  /await printHtmlWithBrother\(html, effectiveOptions\);/,
  "await printHtmlWithBrother(html.html || html, html.widthPoints, html.heightPoints, effectiveOptions);"
);

t = t.replace(
  /const html = buildQrHtml\(value, effectiveOptions\);/,
  "const html = buildQrHtml(value, effectiveOptions);"
);

t = t.replace(
  /const pdf = await Print\.printToFileAsync\(\{ html \}\);/,
  "const pdf = await Print.printToFileAsync({ html, width: widthPoints, height: heightPoints });"
);

fs.writeFileSync(p, t);
