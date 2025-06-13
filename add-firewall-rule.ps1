# Windows PowerShell 스크립트 - 관리자 권한으로 실행 필요
# Next.js 개발 서버(포트 3001)에 대한 방화벽 규칙 추가

# 기존 규칙이 있는지 확인
$existingRule = Get-NetFirewallRule -DisplayName "WSL Next.js Dev Server" -ErrorAction SilentlyContinue

if ($existingRule) {
    Write-Host "방화벽 규칙이 이미 존재합니다. 기존 규칙을 제거하고 새로 추가합니다." -ForegroundColor Yellow
    Remove-NetFirewallRule -DisplayName "WSL Next.js Dev Server"
}

# 새 방화벽 규칙 추가
New-NetFirewallRule -DisplayName "WSL Next.js Dev Server" `
    -Direction Inbound `
    -LocalPort 3001 `
    -Protocol TCP `
    -Action Allow `
    -Profile Any `
    -Description "WSL에서 실행되는 Next.js 개발 서버 접근 허용"

Write-Host "방화벽 규칙이 성공적으로 추가되었습니다!" -ForegroundColor Green
Write-Host "이제 http://localhost:3001 로 접속 가능합니다." -ForegroundColor Cyan

# WSL IP 주소도 허용
$wslIP = bash.exe -c "hostname -I | awk '{print $1}'"
Write-Host "WSL IP 주소: $wslIP" -ForegroundColor Yellow

# 포트 3001이 사용 중인지 확인
$port = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
if ($port) {
    Write-Host "포트 3001이 현재 사용 중입니다." -ForegroundColor Green
} else {
    Write-Host "포트 3001이 아직 사용되지 않고 있습니다. Next.js 서버가 실행 중인지 확인하세요." -ForegroundColor Red
}