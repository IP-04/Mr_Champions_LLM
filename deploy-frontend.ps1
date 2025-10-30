# PowerShell script to deploy frontend correctly

Write-Host "🚀 Deploying UCL ML Platform Frontend..." -ForegroundColor Cyan

# Navigate to client directory
Set-Location -Path "client"

Write-Host "📁 Current directory: $(Get-Location)" -ForegroundColor Yellow

# Check if package.json exists
if (Test-Path "package.json") {
    Write-Host "✅ package.json found!" -ForegroundColor Green
} else {
    Write-Host "❌ package.json not found! Wrong directory?" -ForegroundColor Red
    exit 1
}

# Deploy to Vercel
Write-Host "`n🌐 Deploying to Vercel..." -ForegroundColor Cyan
vercel --prod --yes

Write-Host "`n✅ Deployment complete!" -ForegroundColor Green

