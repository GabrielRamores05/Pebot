docker compose down -v 2>$null
Start-Sleep 5
docker volume rm my-app_app_node_modules my-app_db_data 2>$null
Start-Sleep 3
docker compose up -d 2>$null
Write-Host 'Waiting for full startup...'
Start-Sleep 45
docker ps --format '{{.Names}} {{.Status}}'