const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, 'app', 'order', '[orderNumber]', 'page.tsx'), 'utf-8');
const lines = content.split('\n');
for (let i = 793; i < 800; i++) {
  console.log((i+1) + ': ' + JSON.stringify(lines[i]));
}
