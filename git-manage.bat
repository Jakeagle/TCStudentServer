@echo off
REM Trinity Capital Git Management Script for Windows
REM This script helps manage the two-repository setup for Trinity Capital

echo 🚀 Trinity Capital Git Management
echo =================================

REM Check if we're in the right directory
if not exist "server.js" (
    echo ❌ Error: Please run this script from the Trinity Capital root directory
    exit /b 1
)

if "%1"=="status" goto :show_status
if "%1"=="server" goto :push_server
if "%1"=="frontend" goto :push_frontend
if "%1"=="both" goto :push_both
if "%1"=="all" goto :push_both
if "%1"=="pull" goto :pull_both
if "%1"=="setup" goto :setup
if "%1"=="deploy" goto :deploy_production
if "%1"=="local" goto :revert_to_local
if "%1"=="clean" goto :clean_server
goto :usage

:show_status
echo.
echo 📊 Current Git Status:
echo ----------------------
git status --short
echo.
echo 🔗 Git Remotes:
git remote -v
echo.
goto :end

:push_server
echo 🔧 Pushing Server Files to TCStudentServer...

REM Backup current .gitignore
if exist ".gitignore" copy ".gitignore" ".gitignore.backup" >nul

REM Use server-specific .gitignore
copy "server.gitignore" ".gitignore" >nul

REM Add server files (excluding Frontend)
git add .
git add server.js schedulerManager.js catchupScheduler.js package.json package-lock.json public/
git add *.js *.md *.json *.html

REM Remove Frontend from staging if it was added
git reset HEAD Frontend/ 2>nul

set /p commit_message="📝 Enter commit message for server changes: "

git commit -m "SERVER: %commit_message%"

REM Push to server repo
git push server master

REM Restore original .gitignore
if exist ".gitignore.backup" move ".gitignore.backup" ".gitignore" >nul

echo ✅ Server files pushed to TCStudentServer
goto :end

:push_frontend
echo 🎨 Pushing Frontend Files to TrinityCapital...

REM Backup current .gitignore
if exist ".gitignore" copy ".gitignore" ".gitignore.backup" >nul

REM Use frontend-specific .gitignore
copy "frontend.gitignore" ".gitignore" >nul

REM Add only Frontend files
git add Frontend/

set /p commit_message="📝 Enter commit message for frontend changes: "

git commit -m "FRONTEND: %commit_message%"

REM Push to main repo (TrinityCapital)
git push origin master

REM Restore original .gitignore
if exist ".gitignore.backup" move ".gitignore.backup" ".gitignore" >nul

echo ✅ Frontend files pushed to TrinityCapital
goto :end

:push_both
echo 🔄 Pushing to both repositories...
call :push_server
echo.
call :push_frontend
echo.
echo 🎉 Successfully pushed to both repositories!
goto :end

:pull_both
echo ⬇️ Pulling from both repositories...

echo Pulling from TCStudentServer...
git pull server master

echo Pulling from TrinityCapital...
git pull origin master

echo ✅ Successfully pulled from both repositories!
goto :end

:setup
echo 🔧 Setting up Git remotes...
git remote add server https://github.com/Jakeagle/TCStudentServer.git 2>nul
if errorlevel 1 echo Server remote already exists
echo ✅ Git setup complete!
call :show_status
goto :end

:usage
echo Usage: %0 {status^|server^|frontend^|both^|pull^|setup^|deploy^|local}
echo.
echo Commands:
echo   status    - Show current git status
echo   server    - Commit and push server files to TCStudentServer
echo   frontend  - Commit and push frontend files to TrinityCapital
echo   both      - Push to both repositories
echo   pull      - Pull from both repositories
echo   setup     - Setup git remotes
echo   deploy    - Replace localhost URLs with production URLs and deploy
echo   local     - Revert production URLs back to localhost for development
echo.
echo Examples:
echo   %0 status
echo   %0 server
echo   %0 deploy
echo   %0 local
goto :end

:deploy_production
echo 🚀 Deploying to Production...
echo 📝 Replacing localhost URLs with production URLs...

REM Create backup before changes
if not exist "temp_backup" mkdir temp_backup
copy "Frontend\Javascript\*.js" "temp_backup\" >nul 2>&1
copy "server.js" "temp_backup\" >nul 2>&1

REM Replace URLs using PowerShell script
powershell -ExecutionPolicy Bypass -File "url-replacer.ps1" -Mode "production"

echo 📤 Committing and pushing to both repositories...
call :push_both

echo 🔄 Restoring local development URLs...
powershell -ExecutionPolicy Bypass -File "url-replacer.ps1" -Mode "local"

REM Clean up backup
rmdir /s /q "temp_backup" 2>nul

echo 🎉 Production deployment complete!
goto :end

:revert_to_local
echo 🔄 Reverting to localhost URLs for local development...
powershell -ExecutionPolicy Bypass -File "url-replacer.ps1" -Mode "local"
echo ✅ Localhost URLs restored for local development
goto :end

:clean_server
echo 🧹 Cleaning unauthorized files from server repository...
echo ⚠️ This will remove unauthorized files from the server repository only.
echo ❗ Your local files will not be affected.
set /p "confirm=Are you sure you want to proceed? (Y/N): "
if /i "%confirm%" neq "Y" goto :end

REM Create a temporary directory for the clean operation
echo 📁 Creating temporary workspace...
set "temp_dir=temp_server_clean_%RANDOM%"
mkdir %temp_dir%
cd %temp_dir%

REM Clone only the server repository
echo 🔄 Cloning server repository...
git clone https://github.com/Jakeagle/TCStudentServer.git .

REM Remove everything except .git
echo 🗑️ Removing all files from server repository...
for /d %%d in (*) do if "%%d" neq ".git" rd /s /q "%%d"
for %%f in (*) do del "%%f"

REM Copy only authorized files from parent directory
echo 📋 Copying authorized files...
copy ..\server.js .
copy ..\schedulerManager.js .
copy ..\catchupScheduler.js .
copy ..\package.json .
copy ..\package-lock.json .
copy ..\server.gitignore .
xcopy /E /I ..\public public

REM Commit and push changes
echo 📤 Committing changes...
git add -A
git commit -m "CLEANUP: Remove unauthorized files from server repository"
git push origin master

REM Clean up
echo 🧹 Cleaning up temporary files...
cd ..
rd /s /q %temp_dir%

echo ✅ Server repository cleaned - only authorized files remain
goto :end

:end
