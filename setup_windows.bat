@echo off
setlocal EnableExtensions

echo.
echo ==========================================
echo   Race Master Bot V1.0.0 - Windows Setup
echo      Created By: YouGotGapped
echo          Discord: gapp3d_
echo ==========================================
echo.

REM Move to the folder this script is in
cd /d "%~dp0"

REM If .env already exists, warn
if exist ".env" (
  echo [!] A .env file already exists.
  choice /M "Overwrite it"
  if errorlevel 2 (
    echo Cancelled. Keeping existing .env
    goto :EOF
  )
)

echo Enter your Discord Bot settings:
echo (Tip: Right-click to paste in CMD)
echo.

set "DISCORD_TOKEN="
set /p DISCORD_TOKEN=DISCORD_TOKEN (Bot Token): 

set "CLIENT_ID="
set /p CLIENT_ID=CLIENT_ID (Application ID): 

set "GUILD_ID="
set /p GUILD_ID=GUILD_ID (Server ID - leave blank for global cmds): 

set "LADDER_CHANNEL_ID="
set /p LADDER_CHANNEL_ID=LADDER_CHANNEL_ID: 

set "RACE_DIRECTOR_ROLE_ID="
set /p RACE_DIRECTOR_ROLE_ID=RACE_DIRECTOR_ROLE_ID: 

set "REQUIRE_LADDER_CHANNEL=true"
set /p REQUIRE_LADDER_CHANNEL=REQUIRE_LADDER_CHANNEL (true/false) [default true]: 
if "%REQUIRE_LADDER_CHANNEL%"=="" set "REQUIRE_LADDER_CHANNEL=true"

REM Basic validation (minimal)
if "%DISCORD_TOKEN%"=="" goto :missing
if "%CLIENT_ID%"=="" goto :missing
if "%LADDER_CHANNEL_ID%"=="" goto :missing
if "%RACE_DIRECTOR_ROLE_ID%"=="" goto :missing

echo Writing .env ...
(
  echo DISCORD_TOKEN=%DISCORD_TOKEN%
  echo CLIENT_ID=%CLIENT_ID%
  echo GUILD_ID=%GUILD_ID%
  echo LADDER_CHANNEL_ID=%LADDER_CHANNEL_ID%
  echo RACE_DIRECTOR_ROLE_ID=%RACE_DIRECTOR_ROLE_ID%
  echo REQUIRE_LADDER_CHANNEL=%REQUIRE_LADDER_CHANNEL%
) > .env

echo.
echo ✅ Created .env

echo.
choice /M "Run npm install now"
if errorlevel 2 goto :skipnpm

echo.
echo Installing dependencies...
call npm install
if errorlevel 1 (
  echo ❌ npm install failed. Make sure Node.js is installed, then rerun setup.bat
  goto :EOF
)

:skipnpm
echo.
choice /M "Start the bot now (npm start)"
if errorlevel 2 goto :pm2ask

echo.
call npm start
goto :EOF

:pm2ask
echo.
choice /M "Set up pm2 to run in background (optional)"
if errorlevel 2 goto :EOF

echo.
echo Installing pm2 globally...
call npm install -g pm2
if errorlevel 1 (
  echo ❌ Failed to install pm2. Try running CMD as Administrator.
  goto :EOF
)

echo Starting bot with pm2...
call pm2 start index.js --name race-master-bot
call pm2 save

echo.
echo ✅ pm2 started the bot. To auto-start on reboot, run:
echo    pm2 startup
echo (Then run the command pm2 prints.)
goto :EOF

:missing
echo.
echo ❌ Missing required values. DISCORD_TOKEN, CLIENT_ID, LADDER_CHANNEL_ID, RACE_DIRECTOR_ROLE_ID are required.
echo No .env written.
exit /b 1
