# 🏁 RaceMaster Bot v1.1.0

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
- Random ET drawings (`/randomet`)
- Cryptographically secure ET generation with no recent duplicates
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
- **Create Role**: Server Settings → Roles → Create **Race Director**
- **Role ID**: Right-click the role → *Copy Role ID*

---

## ⚙️ Step 3: Configure the Bot (`.env`)

RaceMaster Bot uses environment variables for configuration.

### Create `.env`

**Option A – Copy template**
```bash
cp .env.example .env
