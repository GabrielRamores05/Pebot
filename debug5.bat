@echo off
pushd "D:\Buggy The Coffee Project\05_Buggy_v3_i_41026\cafe"
cd /d my-app
npx -y node -e "const c=require('fs').readFileSync('app/order/[orderNumber]/page.tsx','utf-8');const lines=c.split('\n');for(let i=495;i<560;i++){console.log((i+1)+': '+lines[i])}"
popd
