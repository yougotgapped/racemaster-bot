#!/usr/bin/env bash
set -euo pipefail

echo ==========================================
echo   Race Master Bot V1.2.0 - Windows Setup
echo      Created By: YouGotGapped
echo          Discord: gapp3d_
echo ==========================================
echo.

# Go to the folder where this script is located
cd "$(dirname "$0")"

# Warn if .env exists
if [ -f ".env" ]; then
  echo "⚠️  .env already exists. This will overwrite it."
  read -r -p "Continue? (y/N): " OVER
  OVER="${OVER:-N}"
  if [[ ! "$OVER" =~ ^[Yy]$ ]]; then
    echo "Cancelled. Keeping existing .env"
    exit 0
  fi
fi

echo ""
echo "=== CORE BOT SETTINGS ==="
read -r -p "DISCORD_TOKEN (bot token): " DISCORD_TOKEN
read -r -p "CLIENT_ID (application ID): " CLIENT_ID
read -r -p "GUILD_ID (optional - leave blank for global cmds): " GUILD_ID
read -r -p "LADDER_CHANNEL_ID (channel ID): " LADDER_CHANNEL_ID
read -r -p "RACE_DIRECTOR_ROLE_ID (role ID): " RACE_DIRECTOR_ROLE_ID
read -r -p "REQUIRE_LADDER_CHANNEL (true/false) [default true]: " REQUIRE_LADDER_CHANNEL
REQUIRE_LADDER_CHANNEL="${REQUIRE_LADDER_CHANNEL:-true}"

echo ""
echo "=== TOP 10 LEADERBOARD SETTINGS ==="
read -r -p "TOP10_APPROVAL_CHANNEL_ID (channel ID): " TOP10_APPROVAL_CHANNEL_ID
read -r -p "TOP10_TRACK_CHANNEL_ID (channel ID): " TOP10_TRACK_CHANNEL_ID
read -r -p "TOP10_STREET_CHANNEL_ID (channel ID): " TOP10_STREET_CHANNEL_ID
read -r -p "TOP10_ROLE_ID (role ID): " TOP10_ROLE_ID
read -r -p "TOP10_REQUIRE_PROOF (true/false) [default true]: " TOP10_REQUIRE_PROOF
TOP10_REQUIRE_PROOF="${TOP10_REQUIRE_PROOF:-true}"

# Validate required fields (match setup_windows.bat)
if [[ -z "${DISCORD_TOKEN}" || -z "${CLIENT_ID}" || -z "${LADDER_CHANNEL_ID}" || -z "${RACE_DIRECTOR_ROLE_ID}" ]]; then
  echo ""
  echo "❌ Missing required values."
  echo "Required:"
  echo "  - DISCORD_TOKEN"
  echo "  - CLIENT_ID"
  echo "  - LADDER_CHANNEL_ID"
  echo "  - RACE_DIRECTOR_ROLE_ID"
  echo ""
  echo "No .env written."
  exit 1
fi

echo ""
echo "Writing .env file..."

cat > .env <<EOF
DISCORD_TOKEN=${DISCORD_TOKEN}
CLIENT_ID=${CLIENT_ID}
GUILD_ID=${GUILD_ID}
LADDER_CHANNEL_ID=${LADDER_CHANNEL_ID}
RACE_DIRECTOR_ROLE_ID=${RACE_DIRECTOR_ROLE_ID}
REQUIRE_LADDER_CHANNEL=${REQUIRE_LADDER_CHANNEL}

# === TOP 10 LEADERBOARD ===
TOP10_APPROVAL_CHANNEL_ID=${TOP10_APPROVAL_CHANNEL_ID}
TOP10_TRACK_CHANNEL_ID=${TOP10_TRACK_CHANNEL_ID}
TOP10_STREET_CHANNEL_ID=${TOP10_STREET_CHANNEL_ID}
TOP10_ROLE_ID=${TOP10_ROLE_ID}

# optional
TOP10_REQUIRE_PROOF=${TOP10_REQUIRE_PROOF}
EOF

# Lock down .env so only the current user can read it
chmod 600 .env

echo ""
echo "Installing dependencies..."
npm install

# pm2 is required to match Windows setup behavior
if ! command -v pm2 >/dev/null 2>&1; then
  echo ""
  echo "pm2 not found. Installing pm2 globally..."
  npm install -g pm2
fi

echo ""
echo "Starting bot with pm2..."
pm2 start index.js --name race-master-bot
pm2 save

echo ""
echo "✅ Setup complete!"
echo "To enable auto-start on reboot, run:"
echo "   pm2 startup"
echo "(then run the command pm2 prints)"
