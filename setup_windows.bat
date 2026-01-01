@echo off
setlocal ENABLEDELAYEDEXPANSION

echo ==========================================
echo   Race Master Bot V1.2.0 - Windows Setup
echo      Created By: YouGotGapped
echo          Discord: gapp3d_
echo ==========================================
echo.

:: Prompt for required values
set /p DISCORD_TOKEN=Enter DISCORD BOT TOKEN:
set /p CLIENT_ID=Enter CLIENT ID (Application ID):
set /p GUILD_ID=Enter GUILD ID (Server ID):
set /p LADDER_CHANNEL_ID=Enter LADDER CHANNEL ID:
set /p RACE_DIRECTOR_ROLE_ID=Enter RACE DIRECTOR ROLE ID:

:: Ladder channel enforcement
set /p REQUIRE_LADDER_CHANNEL=Require ladder channel only? (true/false) [true]:
if "%REQUIRE_LADDER_CHANNEL%"=="" set REQUIRE_LADDER_CHANNEL=true

echo.
echo === TOP 10 LEADERBOARD SETUP ===
echo.

set /p TOP10_APPROVAL_CHANNEL_ID=Enter TOP 10 APPROVAL CHANNEL ID:
set /p TOP10_LEADERBOARD_CHANNEL_ID=Enter TOP 10 LEADERBOARD CHANNEL ID:
set /p TOP10_ROLE_ID=Enter TOP 10 ROLE ID:

set /p TOP10_REQUIRE_PROOF=Require proof upload? (true/false) [true]:
if "%TOP10_REQUIRE_PROOF%"=="" set TOP10_REQUIRE_PROOF=true

echo.
echo Writing .env file...
echo.

:: Write .env
(
echo DISCORD_TOKEN=%DISCORD_TOKEN%
echo CLIENT_ID=%CLIENT_ID%
echo GUILD_ID=%GUILD_ID%
echo LADDER_CHANNEL_ID=%LADDER_CHANNEL_ID%
echo RACE_DIRECTOR_ROLE_ID=%RACE_DIRECTOR_ROLE_ID%
echo REQUIRE_LADDER_CHANNEL=%REQUIRE_LADDER_CHANNEL%
echo.
echo # === TOP 10 LEADERBOARD ===
echo TOP10_APPROVAL_CHANNEL_ID=%TOP10_APPROVAL_CHANNEL_ID%
echo TOP10_LEADERBOARD_CHANNEL_ID=%TOP10_LEADERBOARD_CHANNEL_ID%
echo TOP10_ROLE_ID=%TOP10_ROLE_ID%
echo.
echo # optional
echo TOP10_REQUIRE_PROOF=%TOP10_REQUIRE_PROOF%
) > .env

echo.
echo Installing dependencies...
call npm install

echo.
echo ==========================================
echo   Setup complete!
echo ==========================================
echo.
echo To start the bot:
echo   npm start
echo.
pause
