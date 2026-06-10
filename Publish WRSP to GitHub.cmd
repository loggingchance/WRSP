@echo off
setlocal
cd /d "%~dp0"

echo Publishing WRSP from:
echo %CD%
echo.

if not exist "index.html" goto wrong_folder
if not exist "app.js" goto wrong_folder

set "GH_EXE=C:\Program Files\GitHub CLI\gh.exe"
if exist "%GH_EXE%" goto have_gh

where gh >nul 2>nul
if errorlevel 1 goto no_gh
set "GH_EXE=gh"

:have_gh
echo Checking GitHub login...
"%GH_EXE%" auth status
if errorlevel 1 goto no_auth

echo Configuring Git to use GitHub login...
"%GH_EXE%" auth setup-git
if errorlevel 1 goto failed

echo Checking local Git folder...
git rev-parse --is-inside-work-tree >nul 2>nul
if errorlevel 1 (
  echo Initializing Git repository...
  git init -b main
  if errorlevel 1 goto failed
)

echo Setting GitHub destination...
git remote remove origin >nul 2>nul
git remote add origin https://github.com/loggingchance/WRSP.git
if errorlevel 1 goto failed

echo Adding WRSP files...
git add index.html app.js styles.css service-worker.js manifest.webmanifest README.md DEPLOYMENT_CHECKLIST.md WRSP_Project_Tracker.md phone-preview.html .nojekyll .gitignore assets work\dev-server.js "Publish WRSP to GitHub.cmd" "Start WRSP Preview.cmd"
if errorlevel 1 goto failed

echo Committing WRSP files...
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Publish WRSP static app"
  if errorlevel 1 goto failed
) else (
  echo No new file changes to commit.
)

echo Force-pushing first full WRSP publish...
git push --force -u origin main
if errorlevel 1 goto failed

echo.
echo WRSP has been published:
echo https://github.com/loggingchance/WRSP
echo.
pause
goto end

:wrong_folder
echo This script is not in the WRSP app folder.
echo It must be in the same folder as index.html and app.js.
pause
goto end

:no_gh
echo GitHub CLI was not found.
pause
goto end

:no_auth
echo GitHub CLI is not logged in. Run: gh auth login
pause
goto end

:failed
echo.
echo Publish failed. Leave this window open and show Codex the lines above.
echo.
pause

:end
