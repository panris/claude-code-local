@echo off
chcp 65001 >nul 2>&1
title Claude Code 模型配置管理器

echo.
echo =============================================
echo    Claude Code 模型配置管理器
echo =============================================
echo.

cd /d "%~dp0"
set "SCRIPT_DIR=%CD%"
set "SERVER_DIR=%SCRIPT_DIR%\model-config-server"
set "HOME_DIR=%USERPROFILE%\.claude"
set "PROXY_PORT=12654"
set "CONFIG_PORT=3000"

REM ── 清理旧进程 ────────────────────────────────────────────────
echo [清理] 停止旧进程...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%PROXY_PORT%') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%CONFIG_PORT%') do (
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 >nul
echo     完成

REM ── 检测依赖 ──────────────────────────────────────────────────
if not exist "%SERVER_DIR%\node_modules\express" (
    echo.
    echo [首次] 正在安装依赖（稍等 30 秒）...
    cd /d "%SERVER_DIR%"
    call npm install --silent 2>nul
    cd /d "%SCRIPT_DIR%"
    if not exist "%SERVER_DIR%\node_modules\express" (
        echo [错误] 依赖安装失败，请检查网络后重试
        echo 如果网络较慢，可以手动运行 [安装依赖.bat]
        pause
        exit /b 1
    )
)

REM ── 启动服务 ──────────────────────────────────────────────────
echo.
echo [启动] 配置页面 + 代理服务...
start "Claude Config" cmd /c "cd /d "%SERVER_DIR%" && node server-litellm.js"
start "Claude Proxy" cmd /c "cd /d "%SERVER_DIR%" && node proxy.js"

REM ── 等待就绪 ──────────────────────────────────────────────────
echo [等待] 服务启动中...
set "CONFIG_OK=0"
set "WAIT_COUNT=0"
:wait_loop
if %WAIT_COUNT% gtr 15 (
    goto wait_done
)
timeout /t 1 >nul
curl -s http://localhost:%CONFIG_PORT%/ >nul 2>&1
if %ERRORLEVEL% equ 0 (
    set "CONFIG_OK=1"
    goto wait_done
)
set /a WAIT_COUNT+=1
goto wait_loop
:wait_done

REM ── 检测是否已配置模型 ────────────────────────────────────────
set "FIRST_TIME=0"
if "%CONFIG_OK%"=="1" (
    for /f "delims=" %%r in ('curl -s http://localhost:%CONFIG_PORT%/api/status') do (
        echo %%r | findstr /C:"\"configured\":true" >nul 2>&1
        if !ERRORLEVEL! equ 0 set "FIRST_TIME=0"
        echo %%r | findstr /C:"\"configured\":false" >nul 2>&1
        if !ERRORLEVEL! equ 0 set "FIRST_TIME=1"
    )
)

REM ── 打印状态 ──────────────────────────────────────────────────
echo.
echo =============================================
if "%CONFIG_OK%"=="1" (
    echo    配置页面: http://localhost:%CONFIG_PORT%
    echo    代理服务: http://localhost:%PROXY_PORT%  OK
) else (
    echo    [警告] 服务可能未正常启动
    echo    请检查端口 3000 是否被占用
    echo    或手动运行: cd model-config-server ^&^& node server-litellm.js
)
echo =============================================
echo.

REM ── 自动打开浏览器 ────────────────────────────────────────────
if "%CONFIG_OK%"=="1" start http://localhost:%CONFIG_PORT%

REM ── 提示语 ────────────────────────────────────────────────────
if "%FIRST_TIME%"=="1" (
    echo [首次使用 - 请按顺序操作]
    echo.
    echo   1. 浏览器已自动打开配置页面
    echo   2. 点击 [新建配置组] 添加你的 API Key
    echo   3. 选择一个服务商，填入 Key，保存
    echo   4. 点 [激活] 按钮，激活配置
    echo   5. 完成后按 Enter 启动 Claude Code
    echo.
    echo   没有 API Key？推荐注册 [Groq]（完全免费）
    echo   访问: https://console.groq.com
    echo.
    pause
) else (
    echo   按 Enter 启动 Claude Code
    pause
)

REM ── 启动 Claude Code ──────────────────────────────────────────
echo.
echo [启动] Claude Code...
cd /d "%SCRIPT_DIR%"
bun run dev
