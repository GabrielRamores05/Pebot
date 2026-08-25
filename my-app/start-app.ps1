docker compose up -d app
Write-Host "Waiting for app to start..."
Start-Sleep 8
Write-Host "Checking container status..."
docker ps --filter 'name=my-app-app' --format '{{.Status}}'