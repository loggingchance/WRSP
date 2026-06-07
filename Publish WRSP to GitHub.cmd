@echo off
setlocal
cd /d "%~dp0"

set "LOG_FILE=%~dp0publish-output.txt"
echo WRSP publish started at %date% %time% > "%LOG_FILE%"
echo Folder: %CD% >> "%LOG_FILE%"
echo.
echo Publishing WRSP. A log will be saved to:
echo %LOG_FILE%
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
"%GH_EXE%" auth status >> "%LOG_FILE%" 2>&1
if errorlevel 1 goto no_auth

echo Configuring Git to use the GitHub login...
"%GH_EXE%" auth setup-git >> "%LOG_FILE%" 2>&1
if errorlevel 1 goto setup_failed

echo Checking local Git folder...
git rev-parse --is-inside-work-tree >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
  echo This folder is not a Git repository. Initializing it now...
  echo Initializing Git repository. >> "%LOG_FILE%"
  git init -b main >> "%LOG_FILE%" 2>&1
  if errorlevel 1 goto setup_failed
)

echo Setting WRSP GitHub destination...
git remote get-url origin >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
  git remote add origin https://github.com/loggingchance/WRSP.git >> "%LOG_FILE%" 2>&1
) else (
  git remote set-url origin https://github.com/loggingchance/WRSP.git >> "%LOG_FILE%" 2>&1
)
if errorlevel 1 goto setup_failed

echo Preparing WRSP files...
git add index.html app.js styles.css service-worker.js manifest.webmanifest README.md DEPLOYMENT_CHECKLIST.md WRSP_Project_Tracker.md phone-preview.html .nojekyll .gitignore assets "Publish WRSP to GitHub.cmd" "Start WRSP Preview.cmd" >> "%LOG_FILE%" 2>&1
if errorlevel 1 goto commit_failed

git status --short >> "%LOG_FILE%" 2>&1
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Publish WRSP static app" >> "%LOG_FILE%" 2>&1
  if errorlevel 1 goto commit_failed
) else (
  echo No new local file changes to commit. >> "%LOG_FILE%"
)

echo Publishing WRSP to GitHub...
git push --force-with-lease -u origin main >> "%LOG_FILE%" 2>&1
if errorlevel 1 goto push_failed

echo.
echo WRSP has been published to:
echo https://github.com/loggingchance/WRSP
echo WRSP has been published to https://github.com/loggingchance/WRSP >> "%LOG_FILE%"
echo.
pause
goto end

:wrong_folder
echo This script is not in the WRSP app folder.
echo Expected to find index.html and app.js in:
echo %CD%
echo Wrong folder: missing index.html or app.js. >> "%LOG_FILE%"
goto show_log

:no_gh
echo GitHub CLI was not found.
echo GitHub CLI was not found. >> "%LOG_FILE%"
goto show_log

:no_auth
echo GitHub CLI is not logged in.
echo Run: gh auth login
echo GitHub CLI is not logged in. >> "%LOG_FILE%"
goto show_log

:setup_failed
echo GitHub setup failed.
echo GitHub setup failed. >> "%LOG_FILE%"
goto show_log

:commit_failed
echo Commit failed.
echo Commit failed. >> "%LOG_FILE%"
goto show_log

:push_failed
echo Publish failed.
echo Publish failed. >> "%LOG_FILE%"
goto show_log

:show_log
echo.
echo ----- publish-output.txt -----
type "%LOG_FILE%"
echo ----- end log -----
echo.
echo Leave this window open and tell Codex what it says above.
pause

:end
