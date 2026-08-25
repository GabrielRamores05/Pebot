@echo off
pushd "D:\Buggy The Coffee Project\05_Buggy_v3_i_41026\cafe"
cd /d my-app
npx tsc --noEmit 2>&1
popd
