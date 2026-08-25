docker compose down -v 2>$null
Start-Sleep 3
docker compose up -d 2>$null
Write-Host 'Waiting for deps...'
Start-Sleep 30
docker ps --format '{{.Names}} {{.Status}}'