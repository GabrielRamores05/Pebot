const fs = require('fs');

for (const f of ['app/admin/page.tsx', 'app/order/[orderNumber]/page.tsx']) {
  const c = fs.readFileSync(f, 'utf-8');
  let brace = 0;
  let paren = 0;
  let bracket = 0;
  let inString = false;
  let inTemplate = false;
  let inComment = false;
  let inJsxExpr = false;
  let stringChar = '';
  let prev = '';
  
  for (let i = 0; i < c.length; i++) {
    const ch = c[i];
    const next = c[i + 1];
    
    if (inComment) {
      if (ch === '\n') inComment = false;
      continue;
    }
    
    if (inString) {
      if (ch === '\\') { i++; continue; }
      if (ch === stringChar) inString = false;
      continue;
    }
    
    if (inTemplate) {
      if (ch === '\\') { i++; continue; }
      if (ch === '`') inTemplate = false;
      if (ch === '$' && next === '{') { i++; inTemplate = false; /* expression starts */ }
      continue;
    }
    
    // Not in string/template/comment
    if (ch === '/' && next === '/') { inComment = true; i++; continue; }
    if (ch === '/' && next === '*') { inComment = true; i++; continue; }
    if (ch === "'" || ch === '"') { inString = true; stringChar = ch; continue; }
    if (ch === '`') { inTemplate = true; continue; }
    
    if (ch === '{') brace++;
    else if (ch === '}') brace--;
    else if (ch === '(') paren++;
    else if (ch === ')') paren--;
    else if (ch === '[') bracket++;
    else if (ch === ']') bracket--;
    
    prev = ch;
  }
  
  console.log(f + ': brace=' + brace + ' paren=' + paren + ' bracket=' + bracket);
}
