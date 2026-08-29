const Database = require('better-sqlite3');
const db = new Database('my-app/prisma/dev.db');
const rows = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
let schema = '';
for (const row of rows) { schema += row.sql + ";\n\n"; }
console.log(schema);
db.close();
