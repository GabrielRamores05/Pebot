docker compose up -d db 2>$null
Start-Sleep 10
docker compose run --rm toolbox sh -c 'npm install' 2>&1