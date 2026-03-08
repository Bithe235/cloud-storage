@echo off
setlocal

echo [1/3] Starting Rust Engine and Database (Docker)...
docker-compose up -d
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to start Docker containers.
    pause
    exit /b %ERRORLEVEL%
)

echo [2/3] Starting Go Bridge Backend...
start "Go Bridge" cmd /c "cd /d %~dp0backend && taskkill /F /IM bridge.exe 2>nul & go build -o bridge.exe ./cmd/server && bridge.exe"

echo [3/3] Starting Next.js Frontend...
start "Next.js Frontend" cmd /c "cd /d %~dp0client && npm run dev -- -p 3001"

echo.
echo ==========================================
echo ALL SYSTEMS STARTING!
echo Go Bridge: http://localhost:8080
echo Frontend:  http://localhost:3001
echo Rust API:  http://localhost:8000
echo ==========================================
echo.
pause
