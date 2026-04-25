@echo off
chcp 65001 >nul 2>&1
echo.
echo =============================================
echo    依赖检查
echo =============================================
echo.

cd /d "%~dp0\model-config-server"
if exist "node_modules\express" (
    echo     依赖已安装，无需重复操作
    echo.
    echo     直接双击 [启动服务.bat] 即可使用
) else (
    echo     正在安装依赖，请稍等...
    call npm install
    echo.
    echo     安装完成！
    echo     现在可以双击 [启动服务.bat] 开始使用
)
echo.
pause
