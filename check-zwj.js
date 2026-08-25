const fs = require('fs');
const c = fs.readFileSync('app/order/[orderNumber]/page.tsx', 'utf-8');
const lines = c.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    const code = line.charCodeAt(j);
    if (code === 0x200D) {
      console.log('ZWJ at line ' + (i+1) + ' col ' + (j+1));
    }
  }
}
