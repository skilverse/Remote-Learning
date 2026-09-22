# PowerShell Test Runner for Local Docker / Service verification
Write-Host "Running LRS Pipeline verification test..." -ForegroundColor Cyan

docker run --rm --network host -v "${PWD}:/app" -w /app node:20-alpine node scripts/test-pipeline.js
