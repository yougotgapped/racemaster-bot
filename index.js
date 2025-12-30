/*!
 * RaceMaster Bot
 * Copyright (c) 2025 RaceMaster Bot
 * Licensed under the MIT License.
 * See LICENSE file in the project root for full license information.
 */


require("dotenv").config();
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
} = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const LADDER_CHANNEL_ID = process.env.LADDER_CHANNEL_ID;
const RACE_DIRECTOR_ROLE_ID = process.env.RACE_DIRECTOR_ROLE_ID;

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
  ];

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log("✅ Slash commands registered.");
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", () => console.log(`✅ Logged in as ${client.user.tag}`));

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
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
        // wipe all active ladders (simple + reliable)
        ladders.clear();
        return interaction.reply("🧹 Ladder reset.");
      }
    }

    if (interaction.isButton()) {
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

      // ✅ Get state by the MESSAGE ID that owns the buttons
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

        // ✅ NEW: If that winner ends the event, finalize immediately
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
