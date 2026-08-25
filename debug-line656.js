const fs = require('fs');
const c = fs.readFileSync('my-app/app/order/[orderNumber]/page.tsx', 'utf-8');
const lines = c.split('\n');

// Check line 656 (0-indexed: 655) in detail
const line = lines[655];
console.log('Line 656:', JSON.stringify(line));
console.log('Line 656 length:', line.length);

// Check all non-ASCII chars
for (let i = 0; i < line.length; i++) {
  const code = line.charCodeAt(i);
  if (code > 127) {
    console.log('  Non-ASCII at pos ' + (i+1) + ': U+' + code.toString(16));
  }
}
