# 🏁 RaceMaster Bot v1.0.0

> **Windows users:** use `setup_windows.bat`  
> **Linux / VPS users:** use `setup_vps.sh`

RaceMaster Bot is a Discord bot built to **run drag racing events smoothly and automatically**.  
It creates randomized race ladders, lets race directors select winners using buttons, and advances rounds until a final champion is crowned.

---

## 🚀 Features
- Randomized drag racing ladders
- Button-based winner selection
- Automatic round advancement
- Role-based race director controls
- Optional ladder-channel enforcement
- Simple `.env` configuration
- Windows & Linux/VPS support

---

## 📋 Requirements
- **Node.js** (LTS recommended)
- A **Discord Server** with admin access
- A **Discord Application + Bot**
- Discord **Bot Token**
- Discord **Application ID (CLIENT_ID)**
- A **ladder channel**
- A **Race Director role** (or users with *Manage Events* permission)

---

## 🔧 Step 1: Create the Bot (Discord Developer Portal)

1. Go to **Discord Developer Portal** → **Applications** → **New Application**
2. Name your application and create it
3. Go to **Bot** → **Add Bot**
4. Copy and save:
   - **Bot Token** → `DISCORD_TOKEN`
   - **Application ID** → `CLIENT_ID`  
     *(Found under **General Information**)*

### Invite the Bot to Your Server
In **OAuth2 → URL Generator**:

**Scopes**
- `bot`
- `applications.commands`

**Bot Permissions**
- View Channels  
- Send Messages  
- Read Message History  

Use the generated URL to invite the bot to your server.

---

## 🧰 Step 2: Enable Developer Mode in Discord

1. Discord **User Settings** → **Advanced**
2. Enable **Developer Mode**

### Copy Required IDs
- **Channel ID**: Right-click the ladder channel → *Copy Channel ID*
- **Create Role**: Server Settings → Roles → Create **RaceMaster Bot**
- **Role ID**: Right-click the role → *Copy Role ID*

---

## ⚙️ Step 3: Configure the Bot (`.env`)

RaceMaster Bot uses environment variables for configuration.

### Create `.env`

**Option A – Copy template**
```
cp .env.example .env
```

**Option B – Interactive setup (recommended)**
- Windows: `setup_windows.bat`
- Linux / VPS: `setup_vps.sh`

### `.env` Variables Explained
- `DISCORD_TOKEN` – Your bot token
- `CLIENT_ID` – Discord application ID
- `GUILD_ID` – *(Optional)* Register commands to one server (faster updates)
- `LADDER_CHANNEL_ID` – Channel where ladder commands are allowed
- `RACE_DIRECTOR_ROLE_ID` – Role allowed to manage races
- `REQUIRE_LADDER_CHANNEL` –  
  - `true` → Commands only work in ladder channel  
  - `false` → Commands allowed anywhere

---

## 🪟 Windows Setup

### Interactive Setup (Recommended)
```
setup_windows.bat
```

### Manual Setup
```
npm install
copy .env.example .env
notepad .env
npm start
```

---

## 🐧 Linux / VPS Setup

### Interactive Setup (Recommended)
```
chmod +x setup_vps.sh
./setup_vps.sh
```

### Manual Setup
```
npm install
cp .env.example .env
nano .env
npm start
```

---

## 🏎️ Using the Bot

### `/pair`
Creates a randomized drag racing ladder.

### `/reset_ladder`
Clears the current ladder.

---

## 👮 Permissions
Users can manage races if they:
- Have **Manage Events**, OR
- Have the role set in `RACE_DIRECTOR_ROLE_ID`

---

## 🧯 Troubleshooting

**Slash commands not showing**
- With `GUILD_ID` → instant
- Without → may take several minutes

**Bot online but not responding**
- Check permissions
- Verify `.env`
- Ensure `applications.commands` scope

---

## 🔐 Security
- Never share your bot token
- Never upload `.env`
- Reset token immediately if leaked

---

## 📦 Version
**v1.0.0**

## 📄 License
MIT License — see `LICENSE` file

---

Enjoy racing 🏁  
Built for racers, not spreadsheets.
