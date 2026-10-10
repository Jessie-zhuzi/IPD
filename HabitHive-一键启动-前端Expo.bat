@echo off
chcp 65001 >nul
setlocal

title HabitHive 前端 Expo
cd /d "%~dp0"

echo [HabitHive] 启动前端 Expo...
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

if not exist "apps\mobile\.env" (
  echo [提示] 未找到 apps\mobile\.env
  echo 请复制 apps\mobile\.env.example 为 apps\mobile\.env，并按你的测试方式修改 API 地址后再启动。
  echo  - Web：EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
  echo  - Android 模拟器：EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000
  echo.
)

if not exist "apps\mobile\node_modules" (
  echo [提示] 未找到 apps\mobile\node_modules
  echo 请先执行：npm --prefix apps/mobile install
  pause
  exit /b 1
)

echo [HabitHive] Expo 启动后：
echo  - 终端里按 w 运行 Web
echo  - 终端里按 a 运行 Android（需已启动模拟器/连接设备）
echo.

call npm run dev:mobile

echo.
echo [HabitHive] 前端已退出（可关闭窗口）。
pause
