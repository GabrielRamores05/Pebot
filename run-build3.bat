@echo off
pushd "D:\Buggy The Coffee Project\05_Buggy_v3_i_41026\cafe"
cd /d my-app
set CSC_IDENTITY_AUTO_DISCOVERY=false
npx electron-builder --win --publish never 2>&1
popd
