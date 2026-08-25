@echo off
pushd "D:\Buggy The Coffee Project\05_Buggy_v3_i_41026\cafe"
cd /d my-app
npx -y node -e "const ts=require('typescript');const c=require('fs').readFileSync('app/order/[orderNumber]/page.tsx','utf-8');const lines=c.split('\n');for(let n=600;n<=880;n+=10){const chunk=lines.slice(0,n).join('\n');const src=ts.createSourceFile('test.tsx',chunk,ts.ScriptTarget.ES2017,true,ts.ScriptKind.TSX);if(src.parseDiagnostics.length>0){console.log('ERRORS at line '+n+': '+src.parseDiagnostics.length+' diagnostics');const first=src.parseDiagnostics[0];console.log(ts.flattenDiagnosticMessageText(first.messageText,' ')+' at line '+(first.start!==undefined?src.getLineAndCharacterOfPosition(first.start).line+1:0)+':'+(first.start!==undefined?src.getLineAndCharacterOfPosition(first.start).character+1:0));break}else{console.log('Lines 1-'+n+': OK')}}";
popd
