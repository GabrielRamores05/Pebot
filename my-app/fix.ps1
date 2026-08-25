docker compose down -v 2>$null
Start-Sleep 3
docker volume rm my-app_app_node_modules 2>$null
Start-Sleep 3
docker compose up -d 2>$null
Write-Host 'Waiting for build and start...'
Start-Sleep 60
docker ps --format '{{.Names}} {{.Status}}'