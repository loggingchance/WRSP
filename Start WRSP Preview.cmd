@echo off
setlocal
cd /d "%~dp0"

set "NODE_EXE=C:\Users\steve\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%NODE_EXE%" goto start

where node >nul 2>nul
if errorlevel 1 goto no_node
set "NODE_EXE=node"

:start
start "" http://127.0.0.1:4174
echo WRSP preview is running at http://127.0.0.1:4174
echo.
echo Keep this window open while previewing WRSP.
"%NODE_EXE%" "work\dev-server.js" 4174
goto end

:no_node
echo Could not find Node.js on this computer.
echo Ask Codex to start WRSP another way.
pause

:end
