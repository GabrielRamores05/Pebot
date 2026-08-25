const fs = require('fs');

const files = [
  'app/admin/page.tsx',
  'app/order/[orderNumber]/page.tsx'
];

const ts = require('typescript');

for (const f of files) {
  const c = fs.readFileSync(f, 'utf-8');
  const src = ts.createSourceFile(f, c, ts.ScriptTarget.ES2017, true, ts.ScriptKind.TSX);
  
  if (src.parseDiagnostics.length > 0) {
    const first = src.parseDiagnostics[0];
    const line = src.getLineAndCharacterOfPosition(first.start).line + 1;
    const col = src.getLineAndCharacterOfPosition(first.start).character + 1;
    
    const startLine = Math.max(0, line - 5);
    const endLine = Math.min(src.text.split('\n').length, line + 5);
    const lines = src.text.split('\n');
    
    console.log(f + ':');
    console.log('  First error: ' + ts.flattenDiagnosticMessageText(first.messageText, ' ') + ' at line ' + line + ':' + col);
    console.log('  Context (lines ' + (startLine + 1) + '-' + endLine + '):');
    for (let i = startLine; i < endLine; i++) {
      const marker = (i + 1 === line) ? '>>>' : '   ';
      console.log('  ' + marker + (i + 1) + ': ' + lines[i]);
    }
    console.log('');
    
    // Also show all diagnostics
    console.log('  All diagnostics:');
    for (const d of src.parseDiagnostics) {
      const dline = src.getLineAndCharacterOfPosition(d.start).line + 1;
      const dcol = src.getLineAndCharacterOfPosition(d.start).character + 1;
      console.log('    ' + ts.flattenDiagnosticMessageText(d.messageText, ' ') + ' at line ' + dline + ':' + dcol);
    }
    console.log('');
  } else {
    console.log(f + ': No parse errors');
  }
}
