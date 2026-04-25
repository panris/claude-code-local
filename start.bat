@echo off
chcp 65001 >nul 2>&1
title Claude Code 模型配置管理器

echo.
echo ========================================
echo    Claude Code 一键启动（Windows）
echo ========================================
echo.

REM ── 检测 Node.js ──────────────────────────────────────────────
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [错误] 未找到 Node.js，请先安装：
    echo   https://nodejs.org/
    pause
    exit /b 1
)

REM ── 检测 bun ──────────────────────────────────────────────────
where bun >nul 2>&1
set "CLAUDE_BIN=bun run dev"
if %ERRORLEVEL% neq 0 (
    echo [提示] 未找到 bun，将尝试使用 npm
    where npm >nul 2>&1
    if %ERRORLEVEL% neq 0 (
        echo [错误] 未找到 npm，请先安装 Node.js
        pause
        exit /b 1
    )
    set "CLAUDE_BIN=npm run dev"
)

REM ── 目录 ──────────────────────────────────────────────────────
cd /d "%~dp0"
set "SCRIPT_DIR=%CD%"
set "SERVER_DIR=%SCRIPT_DIR%model-config-server"
set "HOME_DIR=%USERPROFILE%\.claude"

REM ── 端口定义 ──────────────────────────────────────────────────
set PROXY_PORT=12654
set CONFIG_PORT=3000

REM ── 清理旧进程 ────────────────────────────────────────────────
echo [清理] 停止旧进程...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%PROXY_PORT%') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%CONFIG_PORT%') do (
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 2 >nul

REM ── 检查配置目录 ──────────────────────────────────────────────
if not exist "%HOME_DIR%" mkdir "%HOME_DIR%"
if not exist "%HOME_DIR%\.env" (
    echo.
    echo [首次使用] 请先在浏览器打开配置页面，填写你的 API Key
    echo   http://localhost:%CONFIG_PORT%
    echo.
)

REM ── 启动配置管理器 ────────────────────────────────────────────
echo [启动] 配置管理页面...
start "Claude Config" cmd /c "cd /d "%SERVER_DIR%" ^&^& node server-litellm.js"

REM ── 启动代理 ──────────────────────────────────────────────────
echo [启动] 代理服务...
start "Claude Proxy" cmd /c "cd /d "%SERVER_DIR%" ^&^& node proxy.js"

REM ── 等待服务就绪 ──────────────────────────────────────────────
echo [等待] 服务启动中...
timeout /t 3 >nul

REM ── 检查服务 ─────────────────────────────────────────────────
curl -s http://localhost:%CONFIG_PORT%/ >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo.
    echo ========================================
    echo   配置页面: http://localhost:%CONFIG_PORT%
    echo   代理地址: http://localhost:%PROXY_PORT%
    echo ========================================
    echo.
    echo [提示] 按 Ctrl+C 停止所有服务
    echo.
) else (
    echo.
    echo [警告] 配置页面可能未正常启动
    echo   请检查是否端口被占用
    echo.
)

REM ── 启动 Claude Code ─────────────────────────────────────────
echo [启动] Claude Code...
echo.
cd /d "%SCRIPT_DIR%"
%CLAUDE_BIN%

pause
