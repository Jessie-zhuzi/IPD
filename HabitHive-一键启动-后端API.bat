@echo off
chcp 65001 >nul
setlocal

title HabitHive 后端 API
cd /d "%~dp0"

echo [HabitHive] 启动后端 API...
echo 项目目录：%cd%

where node >nul 2>&1
if errorlevel 1 (
  echo [错误] 未找到 Node.js，请先安装 Node.js 22+ 并配置到 PATH。
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [错误] 未找到 npm，请检查 Node.js 安装是否完整。
  pause
  exit /b 1
)

if not exist "apps\api\.env" (
  echo [提示] 未找到 apps\api\.env
  echo 请复制 apps\api\.env.example 为 apps\api\.env，并修改 MySQL 账号密码后再启动。
  pause
  exit /b 1
)

if not exist "apps\api\node_modules" (
  echo [提示] 未找到 apps\api\node_modules
  echo 请先执行：npm --prefix apps/api install
  pause
  exit /b 1
)

echo [HabitHive] API 启动后可访问：
echo   http://localhost:3000/health
echo.

call npm run dev:api

echo.
echo [HabitHive] 后端已退出（可关闭窗口）。
pause
