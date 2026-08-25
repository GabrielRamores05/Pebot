@echo off
pushd "D:\Buggy The Coffee Project\05_Buggy_v3_i_41026\cafe"
cd /d my-app
set NODE_OPTIONS=--max-old-space-size=4096
set HOME=C:\Users\Gab\AppData\Local\Temp\cafeos-home
set USERPROFILE=C:\Users\Gab\AppData\Local\Temp\cafeos-home
set APPDATA=C:\Users\Gab\AppData\Roaming\cafeos-home
npx next build 2>&1
popd
