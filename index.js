/*!
 * RaceMaster Bot
 * Copyright (c) 2025 RaceMaster Bot
 * Licensed under the MIT License.
 * See LICENSE file in the project root for full license information.
 */

require("dotenv").config();
const crypto = require("crypto"); // ✅ NEW: better RNG + unique draws
const fs = require("fs");
const path = require("path");

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const LADDER_CHANNEL_ID = process.env.LADDER_CHANNEL_ID;
const RACE_DIRECTOR_ROLE_ID = process.env.RACE_DIRECTOR_ROLE_ID;

// === TOP 10 LEADERBOARD (optional) ===
const TOP10_APPROVAL_CHANNEL_ID = process.env.TOP10_APPROVAL_CHANNEL_ID;
const TOP10_TRACK_CHANNEL_ID = process.env.TOP10_TRACK_CHANNEL_ID;
const TOP10_STREET_CHANNEL_ID = process.env.TOP10_STREET_CHANNEL_ID;
const TOP10_LEADERBOARD_CHANNEL_ID = process.env.TOP10_LEADERBOARD_CHANNEL_ID;
const TOP10_ROLE_ID = process.env.TOP10_ROLE_ID;
const TOP10_REQUIRE_PROOF = (process.env.TOP10_REQUIRE_PROOF || "true").toLowerCase() === "true";

if (!TOKEN || !CLIENT_ID || !GUILD_ID || !LADDER_CHANNEL_ID || !RACE_DIRECTOR_ROLE_ID) {
  console.error(
    "❌ Missing .env values. Check DISCORD_TOKEN, CLIENT_ID, GUILD_ID, LADDER_CHANNEL_ID, RACE_DIRECTOR_ROLE_ID"
  );
  process.exit(1);
}

/**
 * ✅ IMPORTANT FIXES INCLUDED:
 * 1) Store ladders by MESSAGE ID (so buttons always find the right ladder)
 * 2) When a round finishes and only ONE racer remains, auto-declare Event Winner
 *    (no "Start Round X" in the final)
 *
 * Note: This still uses in-memory storage (like before). If you restart the bot,
 * old buttons from old messages won't work until you run /pair again (normal).
 */
const ladders = new Map(); // key: ladderMessageId, value: state

// ✅ NEW: Keep random ET results from repeating for 60 minutes (per server + range)
const randomHistory = new Map(); 
// key: `${guildId}:${minInt}:${maxInt}:2` -> Map(valueString -> timestampMs)
const RANDOM_TTL_MS = 60 * 60 * 1000; // 60 minutes

function purgeOldRandoms(bucket) {
  const now = Date.now();
  for (const [val, ts] of bucket.entries()) {
    if (now - ts > RANDOM_TTL_MS) bucket.delete(val);
  }
}

/**
 * ✅ NEW: crypto RNG + no-repeat within 60 minutes (2 decimals)
 * Works in .01 steps so values are clean ETs like 4.75 (never 4.747)
 */
function randomETNoRepeat({ guildId, min, max }) {
  const precision = 2;
  const scale = 10 ** precision; // 100

  const lo = Math.min(min, max);
  const hi = Math.max(min, max);

  const minInt = Math.round(lo * scale);
  const maxInt = Math.round(hi * scale);

  if (maxInt < minInt) throw new Error("Invalid range.");

  const totalPossible = maxInt - minInt + 1; // inclusive
  const key = `${guildId || "noguild"}:${minInt}:${maxInt}:${precision}`;

  let bucket = randomHistory.get(key);
  if (!bucket) {
    bucket = new Map();
    randomHistory.set(key, bucket);
  }

  // Purge entries older than 60 minutes
  purgeOldRandoms(bucket);

  // If we've used all possible values within 60 minutes, we cannot avoid duplicates
  if (bucket.size >= totalPossible) {
    return {
      ok: false,
      reason: "No unique values left in the last 60 minutes for this range at 2 decimals.",
      totalPossible,
      lo: (minInt / scale).toFixed(2),
      hi: (maxInt / scale).toFixed(2),
    };
  }

  // Try to find a unique value (you said ~10 pulls at a time, so this is plenty)
  for (let attempt = 0; attempt < 200; attempt++) {
    const n = crypto.randomInt(minInt, maxInt + 1); // inclusive
    const val = (n / scale).toFixed(2);
    if (!bucket.has(val)) {
      bucket.set(val, Date.now());
      return {
        ok: true,
        value: val,
        totalPossible,
        lo: (minInt / scale).toFixed(2),
        hi: (maxInt / scale).toFixed(2),
      };
    }
  }

  // Very unlikely unless the range is nearly exhausted
  return {
    ok: false,
    reason: "Range is nearly exhausted (too many recent values). Try again in a bit.",
    totalPossible,
    lo: (minInt / scale).toFixed(2),
    hi: (maxInt / scale).toFixed(2),
  };
}

// ============================
// TOP 10 LEADERBOARD MODULE
// ============================
const TOP10_DATA_DIR = path.join(__dirname, "data");
const TOP10_DB_PATH = path.join(TOP10_DATA_DIR, "top10.json");
const TOP10_PENDING_PATH = path.join(TOP10_DATA_DIR, "top10_pending.json");

const TOP10_COOLDOWN_PATH = path.join(TOP10_DATA_DIR, "top10_cooldowns.json");
const TOP10_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours per user per board

function ensureTop10Env() {
  const missing = [];
  if (!TOP10_APPROVAL_CHANNEL_ID) missing.push("TOP10_APPROVAL_CHANNEL_ID");
  if (!TOP10_LEADERBOARD_CHANNEL_ID) missing.push("TOP10_LEADERBOARD_CHANNEL_ID");
  if (!TOP10_ROLE_ID) missing.push("TOP10_ROLE_ID");
  return missing;
}

function top10Enabled() {
  return ensureTop10Env().length === 0;
}

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJsonSafe(filePath, data) {
  ensureDirSync(TOP10_DATA_DIR);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function normalizeET(etStr) {
  const s = String(etStr).trim();
  const num = Number(s);
  if (!Number.isFinite(num) || num <= 0) return null;
  return { display: s, value: num };
}

function normalizeMPH(mphStr) {
  const s = String(mphStr).trim();
  const num = Number(s);
  if (!Number.isFinite(num) || num <= 0) return null;
  return { display: s, value: num };
}

function makeSlipId() {
  return crypto.randomBytes(12).toString("hex");
}

async function resolveUserDisplayName(client, guild, userId) {
  try {
    const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
    if (member?.displayName) return member.displayName;
  } catch {}

  try {
    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) return null;
    return user.globalName || user.username || null;
  } catch {
    return null;
  }
}



function sortTop10(entries) {
  // Lowest ET wins. MPH does NOT affect placement.
  // If ET ties, keep the earlier-approved entry higher (stable/deterministic).
  return entries.sort((a, b) => {
    if (a.etValue !== b.etValue) return a.etValue - b.etValue;
    const aT = Number.isFinite(a.approvedAt) ? a.approvedAt : 0;
    const bT = Number.isFinite(b.approvedAt) ? b.approvedAt : 0;
    if (aT !== bT) return aT - bT;
    return String(a.userId).localeCompare(String(b.userId));
  });
}

function getTop10DB() {
  return readJsonSafe(TOP10_DB_PATH, {
    track: [],
    street: [],
    // single leaderboard message id in TOP10_LEADERBOARD_CHANNEL_ID
    messages: { leaderboard: null },
  });
}

function setTop10DB(db) {
  writeJsonSafe(TOP10_DB_PATH, db);
}

function getPendingDB() {
  return readJsonSafe(TOP10_PENDING_PATH, { pending: {} });
}

function setPendingDB(pending) {
  writeJsonSafe(TOP10_PENDING_PATH, pending);
}


function getCooldownDB() {
  return readJsonSafe(TOP10_COOLDOWN_PATH, { cooldowns: {} });
}

function setCooldownDB(db) {
  writeJsonSafe(TOP10_COOLDOWN_PATH, db);
}

function getCooldownKey(userId, type) {
  return `${userId}:${type}`;
}

function nextAllowedAtMs(lastMs) {
  return (Number.isFinite(lastMs) ? lastMs : 0) + TOP10_COOLDOWN_MS;
}

function formatTop10Lines(entries) {
  if (!entries || entries.length === 0) {
    return "_No entries yet. Use `/submitslip` to submit one._";
  }

  return entries
    .map((e, idx) => {
      const place = String(idx + 1).padStart(2, "0");
      const name = e.userName || "Unknown Racer";
      return `**#${place}** — **${name}** — **ET:** \`${e.etDisplay}\` — **MPH:** \`${e.mphDisplay}\``;
    })
    .join("\n");
}

function buildTop10LeaderboardEmbeds(db) {
  const trackText = formatTop10Lines(db.track);
  const streetText = formatTop10Lines(db.street);

  // 🔥 Banner embed (shows at the very top)
  const bannerEmbed = new EmbedBuilder()
    .setImage("https://i.ibb.co/S4k6RFzJ/GGG.png");

  // 🏁 Leaderboard embed (below banner)
  const leaderboardEmbed = new EmbedBuilder()
    .setTitle("🏆 DFWStreets Top 10 Leaderboard")
    .addFields(
      { name: "🏁 Small Tire Top 10 (Track)", value: trackText },
      { name: "🏁 Small Tire Top 10 (Street) ", value: streetText }
    )
    .setFooter({ text: "RaceMaster Bot 2025 • Updated automatically once approved" })
    .setTimestamp(Date.now());

  return [bannerEmbed, leaderboardEmbed];
}


/**
 * Single-channel leaderboard:
 * - Posts ONE embed in TOP10_LEADERBOARD_CHANNEL_ID
 * - Edits the same message on every update
 */
async function upsertLeaderboardMessage(client, guild, db) {
  const channel = await client.channels.fetch(TOP10_LEADERBOARD_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  // Migrate old schema if present
  if (!db.messages || typeof db.messages !== "object") db.messages = {};
  if (!("leaderboard" in db.messages)) db.messages.leaderboard = null;

  const existingMsgId = db.messages.leaderboard || null;
  const embeds = buildTop10LeaderboardEmbeds(db);

  if (existingMsgId) {
    const msg = await channel.messages.fetch(existingMsgId).catch(() => null);
    if (msg) {
      await msg.edit({ embeds, content: "" }).catch(() => {});
      return;
    }
  }

  const newMsg = await channel.send({ embeds }).catch(() => null);
  if (newMsg) {
    db.messages.leaderboard = newMsg.id;
    setTop10DB(db);
  }
}

async function syncTop10Role(guild) {
  const db = getTop10DB();
  const inTop10 = new Set([
    ...db.track.map((e) => e.userId),
    ...db.street.map((e) => e.userId),
  ]);

  const role = await guild.roles.fetch(TOP10_ROLE_ID).catch(() => null);
  if (!role) return;

  // Add role to members in top10
  for (const userId of inTop10) {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (member && !member.roles.cache.has(role.id)) {
      await member.roles.add(role.id).catch(() => {});
    }
  }

  // Remove role from members who have it but are no longer in top10
  for (const [memberId, member] of role.members) {
    if (!inTop10.has(memberId)) {
      await member.roles.remove(role.id).catch(() => {});
    }
  }
}

async function insertApprovedEntry(type, entry) {
  const db = getTop10DB();
  const list = type === "track" ? db.track : db.street;

  // Keep only one entry per user per board
  const filtered = list.filter((e) => e.userId !== entry.userId);
  filtered.push(entry);

  sortTop10(filtered);
  const trimmed = filtered.slice(0, 10);

  if (type === "track") db.track = trimmed;
  else db.street = trimmed;

  setTop10DB(db);
  return db;
}

function buildApprovalEmbed({ type, userId, etDisplay, mphDisplay, proofUrl }) {
  const title = type === "track" ? "Slip Submission (Track)" : "Slip Submission (Street)";
  const emb = new EmbedBuilder()
    .setTitle(title)
    .setDescription(`Submitted by <@${userId}>`)
    .addFields(
      { name: "ET", value: `\`${etDisplay}\``, inline: true },
      { name: "MPH", value: `\`${mphDisplay}\``, inline: true }
    )
    .setTimestamp(Date.now());

  if (proofUrl) emb.addFields({ name: "Proof", value: proofUrl });
  return emb;
}

function buildApprovalButtons(slipId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`top10_approve:${slipId}`).setLabel("Approve").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`top10_deny:${slipId}`).setLabel("Deny").setStyle(ButtonStyle.Danger)
  );
}

/** Fisher-Yates shuffle */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Parse a racer token.
 * Supports:
 * - Mentions: <@123> or <@!123>
 * - Plain text: Mike, Big Mike, etc.
 *
 * NOTE: Button labels cannot render mentions, so we store:
 * - mention: what goes in ladder text (renders as @User)
 * - label: what goes on buttons (clean text)
 *
 * We also store isMention so we don't print "name name" (duplicate) for plain text.
 */
function parseRacerToken(token) {
  const t = token.trim();
  const m = t.match(/^<@!?(\d+)>$/);

  if (m) {
    const id = m[1];
    return {
      raw: t,
      userId: id,
      isMention: true,
      mention: `<@${id}>`,
      label: `@${id}`, // clean text for buttons
    };
  }

  return {
    raw: t,
    userId: null,
    isMention: false,
    mention: t, // used in race line
    label: t, // used in buttons / winner/champion
  };
}

/**
 * Build matches from an array of racer objects:
 * { raw, userId, isMention, mention, label }
 * If odd count, choose a Bye Run that has not happened for that racer before (if possible).
 */
function buildMatches(racers, byeHistory = []) {
  const shuffled = shuffle(racers);
  const matches = [];
  let bye = null;

  if (shuffled.length % 2 === 1) {
    const eligibleIdxs = shuffled
      .map((r, i) => ({ r, i }))
      .filter((x) => !byeHistory.includes(x.r.raw))
      .map((x) => x.i);

    let byeIndex;
    if (eligibleIdxs.length > 0) {
      byeIndex = eligibleIdxs[Math.floor(Math.random() * eligibleIdxs.length)];
    } else {
      byeIndex = Math.floor(Math.random() * shuffled.length);
    }

    bye = shuffled.splice(byeIndex, 1)[0];
  }

  for (let i = 0; i < shuffled.length; i += 2) {
    matches.push({ a: shuffled[i], b: shuffled[i + 1], winner: null });
  }

  return { matches, bye };
}

function ladderToText(state) {
  const lines = [];
  lines.push(`🏁 **${state.eventName || "Drag Event"}**`);
  lines.push(`🏁 **Round ${state.round}**`);
  lines.push("");

  const displayRacer = (r) => (r.isMention ? `${r.label} ${r.mention}` : `**${r.label}**`);
  const displayWinner = (r) => (r.isMention ? `**${r.label}** ${r.mention}` : `**${r.label}**`);

  state.matches.forEach((m, idx) => {
    const w = m.winner ? ` ✅ Winner: ${displayWinner(m.winner)}` : "";
    lines.push(`**Race ${idx + 1}:** ${displayRacer(m.a)} vs ${displayRacer(m.b)}${w}`);
  });

  if (state.bye) {
    lines.push("");
    lines.push(`🏁 **Bye Run:** ${displayWinner(state.bye)} (auto-advances) ✅`);
  }

  if (state.complete) {
    lines.push("");
    lines.push(`🏆 **Event Winner:** ${displayWinner(state.champion)}`);
  }

  return lines.join("\n");
}

function buildButtons(state) {
  const rows = [];
  let row = new ActionRowBuilder();

  state.matches.forEach((m, idx) => {
    const btnA = new ButtonBuilder()
      .setCustomId(`win:${idx}:a`)
      .setLabel(`R${idx + 1}: ${m.a.label}`)
      .setStyle(m.winner?.raw === m.a.raw ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(state.complete);

    const btnB = new ButtonBuilder()
      .setCustomId(`win:${idx}:b`)
      .setLabel(`R${idx + 1}: ${m.b.label}`)
      .setStyle(m.winner?.raw === m.b.raw ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(state.complete);

    for (const btn of [btnA, btnB]) {
      if (row.components.length >= 5) {
        rows.push(row);
        row = new ActionRowBuilder();
      }
      row.addComponents(btn);
    }
  });

  // ✅ Only show "Start Round X" if next round would have 2+ racers.
  const allDecided = state.matches.every((m) => !!m.winner);
  if (!state.complete && allDecided) {
    const winners = state.matches.map((m) => m.winner).filter(Boolean);
    if (state.bye) winners.push(state.bye);

    if (winners.length > 1) {
      const nextBtn = new ButtonBuilder()
        .setCustomId("next_round")
        .setLabel(`Start Round ${state.round + 1}`)
        .setStyle(ButtonStyle.Primary);

      if (row.components.length >= 5) {
        rows.push(row);
        row = new ActionRowBuilder();
      }
      row.addComponents(nextBtn);
    }
  }

  if (row.components.length > 0) rows.push(row);
  return rows;
}

// ✅ Finalize event right after the last match winner is picked (no extra "next round" click needed)
function tryFinalizeEvent(state) {
  if (state.complete) return false;

  const allDecided = state.matches.every((m) => !!m.winner);
  if (!allDecided) return false;

  const winners = state.matches.map((m) => m.winner).filter(Boolean);
  if (state.bye) winners.push(state.bye);

  if (winners.length === 1) {
    state.complete = true;
    state.champion = winners[0];
    return true;
  }

  return false;
}

function advance(state) {
  const winners = state.matches.map((m) => m.winner).filter(Boolean);
  if (state.bye) winners.push(state.bye);

  if (winners.length === 1) {
    state.complete = true;
    state.champion = winners[0];
    return;
  }

  state.round += 1;

  const { matches, bye } = buildMatches(winners, state.byeHistory || []);
  state.matches = matches;
  state.bye = bye;

  if (!state.byeHistory) state.byeHistory = [];
  if (bye) state.byeHistory.push(bye.raw);
}

function isLadderChannel(interaction) {
  return interaction.channelId === LADDER_CHANNEL_ID;
}

function isAuthorized(interaction) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageEvents)) return true;

  const member = interaction.member;
  if (!member) return false;

  const roles = member.roles;

  if (Array.isArray(roles)) {
    return roles.includes(RACE_DIRECTOR_ROLE_ID);
  }

  if (roles?.cache?.has) {
    return roles.cache.has(RACE_DIRECTOR_ROLE_ID);
  }

  return false;
}

async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("pair")
      .setDescription("Create a randomized drag racing ladder from racer names (one per line).")
      .addStringOption((opt) =>
        opt.setName("event").setDescription("Event name (ex: Sunday Grudge Night)").setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName("racers").setDescription("Paste racer names (one per line).").setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
      .toJSON(),

    new SlashCommandBuilder()
      .setName("reset_ladder")
      .setDescription("Reset the ladder in the ladder channel.")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
      .toJSON(),


new SlashCommandBuilder()
  .setName("reset_top10")
  .setDescription("Reset/clear the Top 10 leaderboard (Track + Street).")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
  .toJSON(),


    // ✅ /randomet min max
    new SlashCommandBuilder()
      .setName("randomet")
      .setDescription("Generate a random ET between two ETs (ex: 6.70 to 7.50).")
      .addNumberOption((opt) =>
        opt.setName("min").setDescription("Minimum ET (ex: 4.60)").setRequired(true)
      )
      .addNumberOption((opt) =>
        opt.setName("max").setDescription("Maximum ET (ex: 5.00)").setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
      .toJSON(),


    // ✅ NEW: /submitslip (Top 10 Leaderboard)
    new SlashCommandBuilder()
      .setName("submitslip")
      .setDescription("Submit a Track/Street slip with proof for Top 10 approval.")
      .addStringOption((opt) =>
        opt
          .setName("type")
          .setDescription("Track or Street")
          .setRequired(true)
          .addChoices(
            { name: "Track", value: "track" },
            { name: "Street", value: "street" }
          )
      )
      .addStringOption((opt) =>
        opt.setName("et").setDescription("Your ET (example: 4.70)").setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName("mph").setDescription("Your MPH (example: 152.3)").setRequired(true)
      )
      .addAttachmentOption((opt) =>
        opt
          .setName("proof")
          .setDescription("Upload a clip/screenshot as proof")
          .setRequired(TOP10_REQUIRE_PROOF)
      )
      .toJSON(),
  ];

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log("✅ Slash commands registered.");
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

client.once("ready", () => console.log(`✅ Logged in as ${client.user.tag}`));
// ============================
// AUTO-DELETE CHAT IN TOP 10 CHANNEL
// ============================
// Deletes any non-bot message posted in TOP10_LEADERBOARD_CHANNEL_ID.
// Note: Bot must have "Manage Messages" permission in that channel.
client.on("messageCreate", async (message) => {
  try {
    if (!TOP10_LEADERBOARD_CHANNEL_ID) return;
    if (message.channelId !== TOP10_LEADERBOARD_CHANNEL_ID) return;
    if (message.author?.bot) return;

    // Delete any user message to keep the channel clean (slash commands still work)
    await message.delete().catch(() => {});
  } catch {}
});


client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      // ✅ /randomet allowed in ANY channel
      if (interaction.commandName === "randomet") {
        if (!isAuthorized(interaction)) {
          return interaction.reply({
            content: "❌ Only Race Directors/Admins can use this command.",
            ephemeral: true,
          });
        }

        const min = interaction.options.getNumber("min", true);
        const max = interaction.options.getNumber("max", true);

        if (
          typeof min !== "number" ||
          typeof max !== "number" ||
          Number.isNaN(min) ||
          Number.isNaN(max)
        ) {
          return interaction.reply({ content: "❌ Invalid numbers.", ephemeral: true });
        }

        if (min === max) {
          return interaction.reply({
            content: `🎯 Random ET: **${min.toFixed(2)}** (min and max were the same)`,
            ephemeral: false,
          });
        }

        const res = randomETNoRepeat({
          guildId: interaction.guildId || "noguild",
          min,
          max,
        });

        if (!res.ok) {
          return interaction.reply({
            content:
              `❌ ${res.reason}\n` +
              `Range **${res.lo}–${res.hi}** has **${res.totalPossible}** possible unique values at 2 decimals.\n` +
              `Try again later (after 60 minutes) or widen the range.`,
            ephemeral: true,
          });
        }

        return interaction.reply({
  content: `🎲 Random ET Drawing ${res.lo} - ${res.hi} → Results: **${res.value}**`,
  ephemeral: false,
});


      }


      // ✅ NEW: /submitslip (Top 10) allowed in ANY channel
      if (interaction.commandName === "submitslip") {
        const missing = ensureTop10Env();
        if (missing.length) {
          return interaction.reply({
            content: `❌ Top 10 is not configured. Missing: \`${missing.join(", ")}\``,
            ephemeral: true,
          });
        }

        const type = interaction.options.getString("type", true); // track | street
        const etRaw = interaction.options.getString("et", true);
        const mphRaw = interaction.options.getString("mph", true);
        const proof = interaction.options.getAttachment("proof", false);

        const et = normalizeET(etRaw);
        const mph = normalizeMPH(mphRaw);

        if (!et) return interaction.reply({ content: "❌ Invalid ET. Example: `4.70`", ephemeral: true });
        if (!mph) return interaction.reply({ content: "❌ Invalid MPH. Example: `152.3`", ephemeral: true });
        if (TOP10_REQUIRE_PROOF && !proof) {
          return interaction.reply({ content: "❌ Proof is required. Attach a clip/screenshot.", ephemeral: true });
        }

        // ✅ Cooldown: one APPROVED entry per user per board (track/street) every 24h
        const cooldownDB = getCooldownDB();
        const cdKey = getCooldownKey(interaction.user.id, type);
        const last = cooldownDB.cooldowns?.[cdKey] || 0;
        const allowAt = nextAllowedAtMs(last);
        const now = Date.now();

        if (last && now < allowAt) {
          const unix = Math.ceil(allowAt / 1000);
          return interaction.reply({
            content: `⏳ You already submitted a **${type}** slip in the last 24 hours.
You can submit again **<t:${unix}:R>**.`,
            ephemeral: true,
          });
        }


        
        // ✅ Prevent spam: only one pending submission per user per board at a time
        const pendingNow = getPendingDB();
        const alreadyPending = Object.values(pendingNow.pending || {}).some(
          (p) => p && p.userId === interaction.user.id && p.type === type
        );
        if (alreadyPending) {
          return interaction.reply({
            content: `⏳ You already have a **${type}** slip pending approval. Please wait for it to be approved/denied before submitting another.`,
            ephemeral: true,
          });
        }

const slipId = makeSlipId();
        const proofUrl = proof?.url || null;

        const pendingDB = getPendingDB();
        pendingDB.pending[slipId] = {
          slipId,
          guildId: interaction.guildId,
          userId: interaction.user.id,
          type,
          etDisplay: et.display,
          etValue: et.value,
          mphDisplay: mph.display,
          mphValue: mph.value,
          proofUrl,
          submittedAt: Date.now(),
        };
        setPendingDB(pendingDB);

        const approvalChannel = await interaction.client.channels.fetch(TOP10_APPROVAL_CHANNEL_ID).catch(() => null);
        if (!approvalChannel) {
          return interaction.reply({
            content: "❌ Approval channel not found. Check TOP10_APPROVAL_CHANNEL_ID.",
            ephemeral: true,
          });
        }

        const embed = buildApprovalEmbed({
          type,
          userId: interaction.user.id,
          etDisplay: et.display,
          mphDisplay: mph.display,
          proofUrl,
        });

        await approvalChannel.send({
          content: `📥 New slip pending approval: \`${slipId}\``,
          embeds: [embed],
          components: [buildApprovalButtons(slipId)],
        });

        return interaction.reply({ content: "✅ Submitted! Your slip was sent for approval.", ephemeral: true });
      }


// ✅ /reset_top10 (Top 10 reset) allowed in ANY channel
if (interaction.commandName === "reset_top10") {
  const missing = ensureTop10Env();
  if (missing.length) {
    return interaction.reply({
      content: `❌ Top 10 is not configured. Missing: \`${missing.join(", ")}\``,
      ephemeral: true,
    });
  }

  if (!isAuthorized(interaction)) {
    return interaction.reply({
      content: "❌ Only Race Directors/Admins can reset the Top 10 leaderboard.",
      ephemeral: true,
    });
  }

  // Clear DB + pending
  const db = getTop10DB();
  const oldMsgId = db?.messages?.leaderboard || null;

  db.track = [];
  db.street = [];
  if (!db.messages || typeof db.messages !== "object") db.messages = {};
  db.messages.leaderboard = null;
  setTop10DB(db);

  const pending = getPendingDB();
  pending.pending = {};
  setPendingDB(pending);

  // Clear cooldowns so everyone can submit again immediately after a reset
  setCooldownDB({ cooldowns: {} });

  // Try to delete old message (optional; ignore errors)
  try {
    const ch = await interaction.client.channels.fetch(TOP10_LEADERBOARD_CHANNEL_ID).catch(() => null);
    if (ch && oldMsgId) {
      const msg = await ch.messages.fetch(oldMsgId).catch(() => null);
      if (msg) await msg.delete().catch(() => {});
    }
  } catch {}

  // Post fresh empty leaderboard + sync roles off
  await upsertLeaderboardMessage(interaction.client, interaction.guild, db);
  await syncTop10Role(interaction.guild);

  return interaction.reply({ content: "✅ Top 10 leaderboard has been reset.", ephemeral: true });
}

      // ✅ Ladder-only commands below
      if (!isLadderChannel(interaction)) {
        return interaction.reply({
          content: "❌ Use ladder commands in the ladder channel only.",
          ephemeral: true,
        });
      }

      if (!isAuthorized(interaction)) {
        return interaction.reply({
          content: "❌ Only Race Directors/Admins can run ladder commands.",
          ephemeral: true,
        });
      }

      if (interaction.commandName === "pair") {
        await interaction.deferReply({ ephemeral: false });

        const eventName = interaction.options.getString("event", true);
        const raw = interaction.options.getString("racers", true);

        const racers = raw
          .split(/\r?\n|,/g)
          .map((s) => s.trim())
          .filter(Boolean)
          .map(parseRacerToken);

        if (racers.length < 2) {
          return interaction.editReply("❌ Need at least 2 racers. Paste 2+ names (one per line).");
        }

        const { matches, bye } = buildMatches(racers, []);
        const state = {
          eventName,
          round: 1,
          matches,
          bye,
          complete: false,
          champion: null,
          byeHistory: [],
        };

        if (bye) state.byeHistory.push(bye.raw);

        // ✅ Send the ladder message first, then store by MESSAGE ID
        await interaction.editReply({
          content: ladderToText(state),
          components: buildButtons(state),
        });

        const ladderMsg = await interaction.fetchReply();
        ladders.set(ladderMsg.id, state);

        return;
      }

      if (interaction.commandName === "reset_ladder") {
        ladders.clear();
        return interaction.reply("🧹 Ladder reset.");
      }
    }

    if (interaction.isButton()) {
      // ==========================
      // ✅ TOP 10 Approve / Deny Buttons (work in ANY channel)
      // ==========================
      if (
        interaction.customId.startsWith("top10_approve:") ||
        interaction.customId.startsWith("top10_deny:")
      ) {
        const missing = ensureTop10Env();
        if (missing.length) {
          return interaction.reply({
            content: `❌ Top 10 is not configured. Missing: \`${missing.join(", ")}\``,
            ephemeral: true,
          });
        }

        // Permission: Race Directors/Admins only
        if (!isAuthorized(interaction)) {
          return interaction.reply({
            content: "❌ Only Race Directors/Admins can approve/deny slips.",
            ephemeral: true,
          });
        }

        const [action, slipId] = interaction.customId.split(":");
        const pendingDB = getPendingDB();
        const slip = pendingDB.pending?.[slipId];

        if (!slip) {
          return interaction.reply({
            content: "❌ This slip is no longer pending (or was already handled).",
            ephemeral: true,
          });
        }

        // DENY
        if (action === "top10_deny") {
          delete pendingDB.pending[slipId];
          setPendingDB(pendingDB);

          return interaction.update({
            content: `❌ Denied by <@${interaction.user.id}> — \`${slipId}\``,
            components: [],
          });
        }

        // APPROVE
        const resolvedName = await resolveUserDisplayName(interaction.client, interaction.guild, slip.userId);
        const approvedEntry = {
          userId: slip.userId,
          userName: resolvedName,
          etDisplay: slip.etDisplay,
          etValue: slip.etValue,
          mphDisplay: slip.mphDisplay,
          mphValue: slip.mphValue,
          proofUrl: slip.proofUrl,
          approvedAt: Date.now(),
          approvedBy: interaction.user.id,
        };

        // Insert + sort + trim to top 10
        const db = getTop10DB();
        const list = slip.type === "track" ? db.track : db.street;

        // remove previous entry by same user on that board
        const next = list.filter((e) => e.userId !== approvedEntry.userId);
        next.push(approvedEntry);
        sortTop10(next);
        const trimmed = next.slice(0, 10);

        if (slip.type === "track") db.track = trimmed;
        else db.street = trimmed;
        setTop10DB(db);
        // ✅ Start 24h cooldown on APPROVAL (per user per board)
        const cooldownDB = getCooldownDB();
        const cdKey = getCooldownKey(approvedEntry.userId, slip.type);
        cooldownDB.cooldowns = cooldownDB.cooldowns || {};
        cooldownDB.cooldowns[cdKey] = Date.now();
        setCooldownDB(cooldownDB);



        // clear pending
        delete pendingDB.pending[slipId];
        setPendingDB(pendingDB);

        // update approval message
        await interaction.update({
          content: `✅ Approved by <@${interaction.user.id}> — \`${slipId}\``,
          components: [],
        });

        // update boards
        await upsertLeaderboardMessage(interaction.client, interaction.guild, db);

        // sync Top 10 role
        await syncTop10Role(interaction.guild);

        return;
      }

      if (!isLadderChannel(interaction)) {
        return interaction.reply({
          content: "❌ Ladder buttons only work in the ladder channel.",
          ephemeral: true,
        });
      }

      if (!isAuthorized(interaction)) {
        return interaction.reply({
          content: "❌ Only Race Directors/Admins can select winners.",
          ephemeral: true,
        });
      }

      const state = ladders.get(interaction.message.id);
      if (!state) {
        return interaction.reply({
          content: "❌ No active ladder. Use `/pair` first.",
          ephemeral: true,
        });
      }

      if (interaction.customId === "next_round") {
        const allDecided = state.matches.every((m) => !!m.winner);
        if (!allDecided) {
          return interaction.reply({
            content: "❌ Not all matches have a winner yet.",
            ephemeral: true,
          });
        }

        advance(state);
        return interaction.update({
          content: ladderToText(state),
          components: buildButtons(state),
        });
      }

      if (interaction.customId.startsWith("win:")) {
        const [, idxStr, side] = interaction.customId.split(":");
        const idx = Number(idxStr);
        const match = state.matches[idx];
        if (!match) {
          return interaction.reply({ content: "❌ Invalid match.", ephemeral: true });
        }

        match.winner = side === "a" ? match.a : match.b;

        tryFinalizeEvent(state);

        return interaction.update({
          content: ladderToText(state),
          components: buildButtons(state),
        });
      }
    }
  } catch (err) {
    console.error(err);

    try {
      if (interaction.deferred) {
        await interaction.editReply("❌ Something went wrong.");
      } else if (interaction.isRepliable()) {
        await interaction.reply({ content: "❌ Something went wrong.", ephemeral: true });
      }
    } catch {}
  }
});

(async () => {
  await registerCommands();
  await client.login(TOKEN);
})();
