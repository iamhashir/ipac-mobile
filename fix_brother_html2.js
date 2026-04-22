const fs = require('fs');
const p = 'd:/IPAC_PROD/ipac-operations-app-main/utils/printing/brotherDirectPrint.ts';
let t = fs.readFileSync(p, 'utf8');

t = t.replace(
  /    <\/html>`,\r?\n      widthPoints: widthPx \/ 5,\r?\n      heightPoints: minHeightPx \/ 5\r?\n    };\r?\n    if \(Platform\.OS === 'web'\) \{/m,
  "    </html>`,\n    widthPoints: widthPx / 5,\n    heightPoints: minHeightPx / 5\n  };\n};\n\nconst printHtmlWithBrother = async (html: string, widthPoints?: number, heightPoints?: number, options: BrotherDirectPrintOptions = {}) => {\n  if (Platform.OS === 'web') {"
);

fs.writeFileSync(p, t);
