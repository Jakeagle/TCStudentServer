param(
    [string]$Mode = "production"  # "production" or "local"
)

# Define URL mappings
$urlMappings = @{
    "http://localhost:3000" = "https://tcstudentserver-production.up.railway.app"
    "http://localhost:3001" = "https://tcpurchasingserver-production.up.railway.app"  
    "http://localhost:4000" = "https://tclessonserver-production.up.railway.app"
    "http://localhost:5000" = "https://tcregistrationserver-production.up.railway.app"
}

# Define files to process
$filesToProcess = @(
    "Frontend\Javascript\script.js",
    "Frontend\Javascript\transfer.js", 
    "Frontend\Javascript\deposit.js",
    "Frontend\Javascript\sendMoney.js",
    "Frontend\Javascript\accountSwitch.js",
    "Frontend\Javascript\checkPayeeManager.js",
    "server.js"
)

Write-Host "🔄 URL Replacement Mode: $Mode" -ForegroundColor Yellow

foreach ($file in $filesToProcess) {
    if (Test-Path $file) {
        Write-Host "📝 Processing: $file" -ForegroundColor Cyan
        
        $content = Get-Content $file -Raw
        
        if ($Mode -eq "production") {
            # Replace localhost URLs with production URLs
            foreach ($mapping in $urlMappings.GetEnumerator()) {
                $content = $content -replace [regex]::Escape($mapping.Key), $mapping.Value
            }
        } elseif ($Mode -eq "local") {
            # Replace production URLs with localhost URLs
            foreach ($mapping in $urlMappings.GetEnumerator()) {
                $content = $content -replace [regex]::Escape($mapping.Value), $mapping.Key
            }
        }
        
        Set-Content $file $content -NoNewline
        Write-Host "   ✅ Updated: $file" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  File not found: $file" -ForegroundColor Yellow
    }
}

Write-Host "🎉 URL replacement complete!" -ForegroundColor Green
