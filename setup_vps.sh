#!/usr/bin/env bash
# RaceMaster Bot - VPS/Linux setup script
# This script:
#  - asks you for config values
#  - writes a .env file
#  - installs dependencies
#  - optionally sets up pm2 to run the bot 24/7

set -euo pipefail

echo ""
echo "=========================================="
echo "  Race Master Bot - Linux/VPS Setup"
echo "      Created By: YouGotGapped"
echo "           Discord:gapp3d_"
echo "=========================================="
echo ""

# Go to the folder where this script is located
cd "$(dirname "$0")"

# If .env already exists, ask before overwriting it
if [ -f ".env" ]; then
  echo "[!] A .env file already exists."
  read -r -p "Overwrite it? (y/N): " OVER
  OVER="${OVER:-N}"
  if [[ ! "$OVER" =~ ^[Yy]$ ]]; then
    echo "Cancelled. Keeping existing .env"
    exit 0
  fi
fi

echo ""
echo "Enter your bot settings. (These will be saved into .env)"
echo "Tip: You can paste values into most terminals."
echo ""

read -r -p "DISCORD_TOKEN (bot token): " DISCORD_TOKEN
read -r -p "CLIENT_ID (application ID): " CLIENT_ID
read -r -p "GUILD_ID (optional - leave blank for global cmds): " GUILD_ID
read -r -p "LADDER_CHANNEL_ID (channel ID): " LADDER_CHANNEL_ID
read -r -p "RACE_DIRECTOR_ROLE_ID (role ID): " RACE_DIRECTOR_ROLE_ID
read -r -p "REQUIRE_LADDER_CHANNEL (true/false) [default true]: " REQUIRE_LADDER_CHANNEL
REQUIRE_LADDER_CHANNEL="${REQUIRE_LADDER_CHANNEL:-true}"

# Basic validation
if [[ -z "${DISCORD_TOKEN}" || -z "${CLIENT_ID}" || -z "${LADDER_CHANNEL_ID}" || -z "${RACE_DIRECTOR_ROLE_ID}" ]]; then
  echo ""
  echo "❌ Missing required values."
  echo "Required: DISCORD_TOKEN, CLIENT_ID, LADDER_CHANNEL_ID, RACE_DIRECTOR_ROLE_ID"
  echo "No .env file was written."
  exit 1
fi

echo ""
echo "Writing .env ..."
cat > .env <<EOF
DISCORD_TOKEN=${DISCORD_TOKEN}
CLIENT_ID=${CLIENT_ID}
GUILD_ID=${GUILD_ID}
LADDER_CHANNEL_ID=${LADDER_CHANNEL_ID}
RACE_DIRECTOR_ROLE_ID=${RACE_DIRECTOR_ROLE_ID}
REQUIRE_LADDER_CHANNEL=${REQUIRE_LADDER_CHANNEL}
EOF

# Lock down the .env so only the current user can read it
chmod 600 .env

echo "✅ Created .env (permissions set to 600)"
echo ""

# Install dependencies
read -r -p "Run npm install now? (Y/n): " RUNNPM
RUNNPM="${RUNNPM:-Y}"
if [[ "$RUNNPM" =~ ^[Yy]$ ]]; then
  echo ""
  echo "Installing dependencies..."
  npm install
  echo "✅ Dependencies installed"
fi

# Start the bot now?
echo ""
read -r -p "Start the bot now with npm start? (y/N): " RUNNOW
RUNNOW="${RUNNOW:-N}"
if [[ "$RUNNOW" =~ ^[Yy]$ ]]; then
  echo ""
  npm start
  exit 0
fi

# pm2 background setup (recommended on VPS)
echo ""
read -r -p "Set up pm2 to run 24/7 (recommended on VPS)? (Y/n): " USEPM2
USEPM2="${USEPM2:-Y}"
if [[ "$USEPM2" =~ ^[Yy]$ ]]; then
  echo ""
  if ! command -v pm2 >/dev/null 2>&1; then
    echo "Installing pm2 globally..."
    npm install -g pm2
  fi

  echo "Starting bot with pm2..."
  pm2 start index.js --name race-master-bot
  pm2 save

  echo ""
  echo "✅ pm2 started the bot."
  echo "To auto-start on reboot, run:"
  echo "  pm2 startup"
  echo "Then run the command pm2 prints."
else
  echo ""
  echo "Done. Start later with: npm start"
fi
