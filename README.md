# 🏁 RaceMaster Bot v1.2.0

> **Windows users:** use `setup_windows.bat`  
> **Linux / VPS users:** use `setup_vps.sh`

RaceMaster Bot is a Discord bot built to **run drag racing events and competitive leaderboards smoothly and automatically**.

Version **v1.2.0** introduces a fully automated **Top 10 Leaderboard system** (Track & Street) with approvals, cooldowns, and a clean banner-first presentation — while keeping the original ladder system intact.

---

## 🚀 What’s New in v1.2.0

### 🏆 Top 10 Leaderboard System
- **Single leaderboard channel** with banner on top
- **Small Tire Top 10 (Track & Street)**
- **ET-only ranking** (lower ET = higher placement)
- MPH is displayed but **does not affect placement**
- Auto-updates instantly on approval
- Automatic **Top 10 role assignment**

### ⏱ Submission Rules (Enforced)
- **1 submission per user per class every 24 hours**
- Cooldown starts **after approval**
- Users cannot submit multiple pending slips for the same class
- Proof upload supported (clips or screenshots)


### ✅ Approval Workflow
- Submissions sent to a private **approval channel**
- **Approve / Deny** buttons
- Approved slips immediately update the leaderboard
- Denied slips are removed from pending

### 🔁 Admin Controls
- **`/reset_top10`**
  - Clears Track & Street lists
  - Clears pending submissions
  - Resets cooldowns
  - Removes Top 10 roles
  - Reposts a fresh leaderboard
  
  

---

## 🧩 Core Features (Still Included)
- Randomized drag racing ladders
- Button-based winner selection
- Automatic round advancement
- Final event winner auto-declared
- `/randomet` with crypto-safe, no-repeat logic
- Role-based race director permissions
- Optional ladder-channel enforcement

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

### Invite the Bot to Your Server
In **OAuth2 → URL Generator**:

**Scopes**
- `bot`
- `applications.commands`

**Bot Permissions**
- View Channels  
- Send Messages  
- Read Message History  
- Embed Links  
- Attach Files

Use the generated URL to invite the bot to your server.

---

## 🧰 Step 2: Enable Developer Mode in Discord

1. Discord **User Settings** → **Advanced**
2. Enable **Developer Mode**

### Copy Required IDs
- **Channel ID**: Right-click a channel → *Copy Channel ID*
- **Role ID**: Right-click the Race Director role → *Copy Role ID*

---

## ⚙️ Step 3: Configure the Bot (`.env`)

RaceMaster Bot uses environment variables for configuration.

```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_id
GUILD_ID=your_server_id

LADDER_CHANNEL_ID=ladder_channel_id
RACE_DIRECTOR_ROLE_ID=race_director_role_id

# === TOP 10 LEADERBOARD ===
TOP10_APPROVAL_CHANNEL_ID=approval_channel_id
TOP10_LEADERBOARD_CHANNEL_ID=leaderboard_channel_id
TOP10_ROLE_ID=top10_role_id
TOP10_REQUIRE_PROOF=true
```

---

## ▶️ Step 4: Install & Start

```bash
npm install
npm start
```

---

## 📁 Data Files (Auto-Created)

RaceMaster Bot automatically creates and manages:
```
/data/top10.json
/data/top10_pending.json
/data/top10_cooldowns.json
```

No manual setup required.

---

## 🏁 Commands

### User Commands
- **`/submitslip`** — Submit a Track or Street slip with proof

### Admin / Race Director Commands
- **`/pair`** — Create a randomized race ladder
- **`/reset_ladder`** — Reset the current ladder
- **`/randomet`** — Generate a random ET
- **`/reset_top10`** — Reset the Top 10 leaderboard

---

## 🔒 Permissions
- Race Directors/Admins only:
  - Approve/Deny Top 10 slips
  - Reset the Top 10 leaderboard
  - Manage ladders

---

## 📌 Notes
- Leaderboard placement is based **only on ET**
- MPH is displayed for reference only
- Banner image contains submission rules
- Designed for **Small Tire** but easily expandable

---

## 🏁 License
MIT License — free to use, modify, and improve.
