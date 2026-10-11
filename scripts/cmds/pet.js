const activeSessions = new Map();

const PET_TYPES = {
  dog: { name: "Loyal Hound", icon: "🐕", baseHp: 120, baseAtk: 22, baseDef: 12, cost: 500 },
  cat: { name: "Shadow Feline", icon: "🐈", baseHp: 100, baseAtk: 26, baseDef: 8, cost: 500 },
  dragon: { name: "Ancient Wyrm", icon: "🐉", baseHp: 160, baseAtk: 30, baseDef: 16, cost: 3000 },
  phoenix: { name: "Solar Phoenix", icon: "🦅", baseHp: 130, baseAtk: 28, baseDef: 14, cost: 2500 },
  wolf: { name: "Frost Wolf", icon: "🐺", baseHp: 115, baseAtk: 25, baseDef: 11, cost: 1200 }
};

const SHOP_ITEMS = {
  food_basic: { id: "food_basic", name: "Kibble Bowl", icon: "🍖", cost: 50, type: "care", hunger: 30, energy: 5 },
  food_feast: { id: "food_feast", name: "Royal Feast", icon: "🥩", cost: 200, type: "care", hunger: 75, energy: 20 },
  potion_heal: { id: "potion_heal", name: "Vitality Elixir", icon: "🧪", cost: 150, type: "care", hp: 60, health: 40 },
  toy_ball: { id: "toy_ball", name: "Enchanted Yarn", icon: "🧶", cost: 100, type: "care", happiness: 35, energy: -10 },
  collar_guard: { id: "collar_guard", name: "Iron Spike Collar", icon: "🛡️", cost: 600, type: "gear", stat: "def", boost: 8 },
  claw_sharp: { id: "claw_sharp", name: "Razor Talons", icon: "⚔️", cost: 800, type: "gear", stat: "atk", boost: 10 }
};

function getOrCreatePetState(userData) {
  const current = userData.data?.goatai_pet;
  if (current && current.pet) return current;

  return {
    pet: null,
    inventory: {
      food_basic: 2,
      potion_heal: 1
    },
    gear: {
      collar: null,
      weapon: null
    },
    stats: {
      wins: 0,
      losses: 0,
      adventures: 0,
      prayers: 0
    },
    cooldowns: {
      daily: 0,
      train: 0,
      adventure: 0,
      pray: 0,
      battle: 0,
      bond: 0
    }
  };
}

function clamp(val, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(val)));
}

function formatBar(current, max = 100, length = 8) {
  const filled = Math.max(0, Math.min(length, Math.round((current / max) * length)));
  return "▰".repeat(filled) + "▱".repeat(length - filled);
}

function getPetMaxHp(pet) {
  const base = PET_TYPES[pet.type]?.baseHp || 100;
  return base + (pet.level * 15);
}

function getPetAttack(pet, state) {
  const base = PET_TYPES[pet.type]?.baseAtk || 20;
  const gearBonus = state.gear.weapon ? SHOP_ITEMS[state.gear.weapon]?.boost || 0 : 0;
  return base + (pet.level * 4) + (pet.bonusAtk || 0) + gearBonus;
}

function getPetDefense(pet, state) {
  const base = PET_TYPES[pet.type]?.baseDef || 10;
  const gearBonus = state.gear.collar ? SHOP_ITEMS[state.gear.collar]?.boost || 0 : 0;
  return base + (pet.level * 3) + (pet.bonusDef || 0) + gearBonus;
}

function calculateXpToNext(level) {
  return Math.round(100 * Math.pow(1.3, level - 1));
}

function applyXp(pet, amount) {
  pet.xp += amount;
  let leveledUp = false;
  let required = calculateXpToNext(pet.level);

  while (pet.xp >= required) {
    pet.xp -= required;
    pet.level += 1;
    pet.bonusAtk = (pet.bonusAtk || 0) + 2;
    pet.bonusDef = (pet.bonusDef || 0) + 1;
    pet.currentHp = getPetMaxHp(pet);
    leveledUp = true;
    required = calculateXpToNext(pet.level);
  }

  return leveledUp;
}

function renderPetCard(state, pet, money) {
  const typeInfo = PET_TYPES[pet.type] || { icon: "🐾", name: "Companion" };
  const maxHp = getPetMaxHp(pet);
  const curHp = Math.min(maxHp, pet.currentHp || maxHp);
  const xpNeeded = calculateXpToNext(pet.level);

  return (
    `╭─── 🌟 𝖴𝖫𝖳𝖨𝖬𝖠𝖳𝖤 𝖯𝖤𝖳 𝖴𝖭𝖨𝖵𝖤𝖱𝖲𝖤 𝗏𝟩.𝟢 ───╮\n` +
    `  ${typeInfo.icon} 「 ${pet.name} 」 (${typeInfo.name})\n` +
    `  🎖️ Level: ${pet.level} | ⭐ Rank: ${pet.rank || "Novice"}\n` +
    `  💰 Vault: ${money.toLocaleString()} Coins\n` +
    `├───────────────────────────\n` +
    `  ❤️ HP: ${curHp}/${maxHp} [${formatBar(curHp, maxHp)}]\n` +
    `  🍖 Hunger: ${pet.hunger}/100 [${formatBar(pet.hunger)}]\n` +
    `  ⚡ Energy: ${pet.energy}/100 [${formatBar(pet.energy)}]\n` +
    `  💖 Happiness: ${pet.happiness}/100 [${formatBar(pet.happiness)}]\n` +
    `  ✨ XP: ${pet.xp}/${xpNeeded} [${formatBar(pet.xp, xpNeeded)}]\n` +
    `├───────────────────────────\n` +
    `  ⚔️ ATK: ${getPetAttack(pet, state)} | 🛡️ DEF: ${getPetDefense(pet, state)}\n` +
    `  🏆 Record: ${state.stats.wins}W - ${state.stats.losses}L\n` +
    `  🔮 Spiritual Karma: ${pet.karma || 0}\n` +
    `╰───────────────────────────╯`
  );
}

function formatRemainingTime(ms) {
  if (ms <= 0) return "Ready";
  const seconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remSec = seconds % 60;
  if (minutes > 0) return `${minutes}m ${remSec}s`;
  return `${remSec}s`;
}

module.exports = {
  config: {
    name: "pet",
    version: "7.0.0",
    author: "Nabin | ©GoatAI",
    countDown: 2,
    role: 0,
    shortDescription: {
      en: "Ultimate Pet Universe v7.0 complete pet simulation game."
    },
    description: {
      en: "Deep modular virtual pet companion engine featuring care, shop, activities, bonding, karma, training, and rank battles."
    },
    category: "game",
    guide: {
      en: "{p}pet - View pet profile and navigation dashboard\n" +
          "{p}pet adopt <type> <name> - Adopt a new companion (dog/cat/wolf/phoenix/dragon)\n" +
          "{p}pet shop - Browse the supply bazaar\n" +
          "{p}pet care - Feed, heal, and groom your pet\n" +
          "{p}pet daily - Collect your daily stipend and care pack\n" +
          "{p}pet train [atk/def/spd] - Exercise attributes\n" +
          "{p}pet bond - Deepen emotional bond\n" +
          "{p}pet adventure - Explore dungeons and biomes\n" +
          "{p}pet pray - Visit spiritual sanctum\n" +
          "{p}pet battle - Arena challenger match\n" +
          "{p}pet top - Leaderboard of supreme beastmasters"
    }
  },

  onStart: async function ({ api, args, message, event, usersData, prefix }) {
    const { senderID, threadID } = event;
    const userData = await usersData.get(senderID);
    const balance = userData.money || 0;
    const state = getOrCreatePetState(userData);
    const sub = (args[0] || "").toLowerCase();

    if (!state.pet && sub !== "adopt") {
      let adoptMenu = "🐾 WELCOME TO ULTIMATE PET UNIVERSE v7.0 🐾\nYou do not have a companion yet!\n\nAvailable breeds to adopt:\n";
      for (const [key, val] of Object.entries(PET_TYPES)) {
        adoptMenu += `• [${key}] ${val.icon} ${val.name} - 💰 ${val.cost.toLocaleString()} Coins (HP: ${val.baseHp}, ATK: ${val.baseAtk}, DEF: ${val.baseDef})\n`;
      }
      adoptMenu += `\nSyntax: ${prefix}pet adopt <type> <PetName>\nExample: ${prefix}pet adopt dog Rex`;
      return message.reply(adoptMenu);
    }

    if (sub === "adopt") {
      if (state.pet) {
        return message.reply(`⚠️ You already have a companion named ${state.pet.name}! Nurture your current bond.`);
      }
      const typeKey = (args[1] || "").toLowerCase();
      const petType = PET_TYPES[typeKey];
      const petName = args.slice(2).join(" ").trim();

      if (!petType || !petName) {
        return message.reply(`⚠️ Usage: ${prefix}pet adopt <dog/cat/wolf/phoenix/dragon> <Name>`);
      }
      if (balance < petType.cost) {
        return message.reply(`❌ Insufficient funds! You need ${petType.cost.toLocaleString()} coins to adopt a ${petType.name}.`);
      }

      await usersData.set(senderID, {
        money: balance - petType.cost,
        data: {
          ...userData.data,
          goatai_pet: {
            ...state,
            pet: {
              name: petName,
              type: typeKey,
              level: 1,
              xp: 0,
              rank: "Bronze I",
              currentHp: petType.baseHp,
              hunger: 80,
              energy: 80,
              happiness: 80,
              karma: 10,
              bonusAtk: 0,
              bonusDef: 0
            }
          }
        }
      });

      return message.reply(`✨ Congratulations! You adopted ${petType.icon} ${petName} the ${petType.name} for ${petType.cost.toLocaleString()} coins!\nUse "${prefix}pet" to open your dashboard.`);
    }

    if (sub === "shop") {
      let shopText = "🛍️ ═══════ PET UNIVERSE BAZAAR ═══════ 🛍️\n";
      let idx = 1;
      const indexMap = [];
      for (const [key, item] of Object.entries(SHOP_ITEMS)) {
        shopText += `${idx}. ${item.icon} ${item.name} - 💰 ${item.cost} coins\n   Effect: `;
        if (item.hunger) shopText += `+${item.hunger} Hunger `;
        if (item.happiness) shopText += `+${item.happiness} Joy `;
        if (item.hp) shopText += `+${item.hp} HP `;
        if (item.boost) shopText += `+${item.boost} ${item.stat.toUpperCase()} `;
        shopText += `\n`;
        indexMap.push(key);
        idx++;
      }
      shopText += "\n💬 Reply to this message with the number (1-6) and amount to purchase. (e.g. '1 3' for 3 Kibble Bowls)";

      const info = await message.reply(shopText);
      activeSessions.set(info.messageID, {
        type: "SHOP_BUY",
        authorId: senderID,
        threadId: threadID,
        indexMap,
        expiresAt: Date.now() + 60000
      });
      return;
    }

    if (sub === "care") {
      let careMsg = `🐾 ═══════ PET CARE STATION ═══════ 🐾\n`;
      careMsg += `Current Condition of ${state.pet.name}:\n`;
      careMsg += `❤️ HP: ${state.pet.currentHp}/${getPetMaxHp(state.pet)} | 🍖 Hunger: ${state.pet.hunger}% | ⚡ Energy: ${state.pet.energy}% | 💖 Happiness: ${state.pet.happiness}%\n\n`;
      careMsg += `🎒 Your Supplies:\n`;
      const invKeys = Object.keys(state.inventory || {}).filter(k => (state.inventory[k] || 0) > 0);
      if (invKeys.length === 0) {
        careMsg += `Your backpack is empty! Visit the shop using "${prefix}pet shop" to buy rations and elixirs.`;
        return message.reply(careMsg);
      }
      invKeys.forEach((key, i) => {
        const itm = SHOP_ITEMS[key] || { name: key, icon: "📦" };
        careMsg += `${i + 1}. ${itm.icon} ${itm.name} (Owned: ${state.inventory[key]})\n`;
      });
      careMsg += `\n💬 Reply with the item number to use it on ${state.pet.name}.`;

      const info = await message.reply(careMsg);
      activeSessions.set(info.messageID, {
        type: "CARE_USE",
        authorId: senderID,
        threadId: threadID,
        invKeys,
        expiresAt: Date.now() + 60000
      });
      return;
    }

    if (sub === "daily") {
      const now = Date.now();
      const cooldown = 24 * 60 * 60 * 1000;
      const lastDaily = state.cooldowns.daily || 0;
      if (now - lastDaily < cooldown) {
        const rem = formatRemainingTime(cooldown - (now - lastDaily));
        return message.reply(`⏳ Daily rewards are recharging! Check back in ${rem}.`);
      }

      const stipend = 500 + (state.pet.level * 50);
      state.cooldowns.daily = now;
      state.inventory.food_basic = (state.inventory.food_basic || 0) + 2;
      state.inventory.potion_heal = (state.inventory.potion_heal || 0) + 1;
      state.pet.happiness = clamp(state.pet.happiness + 20);

      await usersData.set(senderID, {
        money: balance + stipend,
        data: {
          ...userData.data,
          goatai_pet: state
        }
      });

      return message.reply(
        `🏃 ═══════ DAILY CARE GRANT ═══════ 🏃\n` +
        `You completed your daily regimen for ${state.pet.name}!\n` +
        `• 💰 Received: +${stipend.toLocaleString()} Coins\n` +
        `• 🍖 Stocked: +2 Kibble Bowls\n` +
        `• 🧪 Stocked: +1 Vitality Elixir\n` +
        `• 💖 Happiness: +20%`
      );
    }

    if (sub === "train") {
      const now = Date.now();
      const cooldown = 30 * 60 * 1000;
      if (now - (state.cooldowns.train || 0) < cooldown) {
        return message.reply(`⏳ ${state.pet.name} is catching their breath. Training available in ${formatRemainingTime(cooldown - (now - state.cooldowns.train))}.`);
      }
      if (state.pet.energy < 20 || state.pet.hunger < 15) {
        return message.reply(`⚠️ ${state.pet.name} is too exhausted or hungry to train! Feed and rest them first.`);
      }

      const focus = (args[1] || "atk").toLowerCase();
      let statGained = "bonusAtk";
      let statLabel = "Attack";
      if (focus === "def") {
        statGained = "bonusDef";
        statLabel = "Defense";
      }

      state.cooldowns.train = now;
      state.pet.energy = clamp(state.pet.energy - 20);
      state.pet.hunger = clamp(state.pet.hunger - 15);
      state.pet[statGained] = (state.pet[statGained] || 0) + 2;
      const leveled = applyXp(state.pet, 40);

      await usersData.set(senderID, {
        data: { ...userData.data, goatai_pet: state }
      });

      let res = `💪 ═══════ INTENSE DRILL ═══════ 💪\n${state.pet.name} tackled grueling conditioning!\n• +2 ${statLabel}\n• +40 EXP\n• -20 Energy | -15 Hunger`;
      if (leveled) res += `\n🎉 LEVEL UP! ${state.pet.name} reached Level ${state.pet.level}!`;
      return message.reply(res);
    }

    if (sub === "bond") {
      const now = Date.now();
      const cooldown = 15 * 60 * 1000;
      if (now - (state.cooldowns.bond || 0) < cooldown) {
        return message.reply(`⏳ Emotional bonding ready in ${formatRemainingTime(cooldown - (now - state.cooldowns.bond))}.`);
      }

      state.cooldowns.bond = now;
      state.pet.happiness = clamp(state.pet.happiness + 25);
      state.pet.karma = (state.pet.karma || 0) + 2;
      const leveled = applyXp(state.pet, 20);

      const events = [
        `You gently brushed ${state.pet.name}'s coat under the shade tree.`,
        `You shared a peaceful walk along the shoreline with ${state.pet.name}.`,
        `You taught ${state.pet.name} a fun trick and celebrated with hugs.`
      ];
      const pick = events[Math.floor(Math.random() * events.length)];

      await usersData.set(senderID, {
        data: { ...userData.data, goatai_pet: state }
      });

      let res = `🎭 ═══════ HEART BONDING ═══════ 🎭\n${pick}\n• +25 Happiness\n• +2 Spiritual Karma\n• +20 EXP`;
      if (leveled) res += `\n🎉 LEVEL UP! Level ${state.pet.level}!`;
      return message.reply(res);
    }

    if (sub === "pray") {
      const now = Date.now();
      const cooldown = 45 * 60 * 1000;
      if (now - (state.cooldowns.pray || 0) < cooldown) {
        return message.reply(`⏳ The celestial altar is dim. Return in ${formatRemainingTime(cooldown - (now - state.cooldowns.pray))}.`);
      }

      state.cooldowns.pray = now;
      state.stats.prayers = (state.stats.prayers || 0) + 1;
      const karmaBoost = Math.floor(Math.random() * 5) + 3;
      state.pet.karma = (state.pet.karma || 0) + karmaBoost;
      state.pet.happiness = clamp(state.pet.happiness + 15);
      state.pet.currentHp = getPetMaxHp(state.pet);

      await usersData.set(senderID, {
        data: { ...userData.data, goatai_pet: state }
      });

      return message.reply(
        `🌟 ═══════ SPIRITUAL SANCTUM ═══════ 🌟\n` +
        `You brought ${state.pet.name} to the ancient shrine.\n` +
        `A divine glow envelops your companion!\n` +
        `• Full HP Restored!\n` +
        `• +${karmaBoost} Spiritual Karma (Total: ${state.pet.karma})\n` +
        `• +15 Happiness`
      );
    }

    if (sub === "adventure") {
      const now = Date.now();
      const cooldown = 20 * 60 * 1000;
      if (now - (state.cooldowns.adventure || 0) < cooldown) {
        return message.reply(`⏳ Expedition underway. Next journey ready in ${formatRemainingTime(cooldown - (now - state.cooldowns.adventure))}.`);
      }
      if (state.pet.energy < 25) {
        return message.reply(`⚠️ ${state.pet.name} needs at least 25 energy to explore deep biomes!`);
      }

      state.cooldowns.adventure = now;
      state.pet.energy = clamp(state.pet.energy - 25);
      state.pet.hunger = clamp(state.pet.hunger - 15);
      state.stats.adventures = (state.stats.adventures || 0) + 1;

      const outcomes = [
        { title: "Misty Ruins", coins: 350, xp: 50, item: "food_basic", desc: "discovered an ancient supply vault!" },
        { title: "Crystal Caverns", coins: 600, xp: 75, item: "potion_heal", desc: "mined luminous quartz and recovered an elixir!" },
        { title: "Shadow Grove", coins: 200, xp: 35, item: null, desc: "fended off feral beasts and retreated safely." }
      ];
      const resEvent = outcomes[Math.floor(Math.random() * outcomes.length)];
      if (resEvent.item) {
        state.inventory[resEvent.item] = (state.inventory[resEvent.item] || 0) + 1;
      }
      const leveled = applyXp(state.pet, resEvent.xp);

      await usersData.set(senderID, {
        money: balance + resEvent.coins,
        data: { ...userData.data, goatai_pet: state }
      });

      let res = `🗺️ ═══════ BIOME EXPEDITION: ${resEvent.title} ═══════ 🗺️\n` +
        `${state.pet.name} ${resEvent.desc}\n` +
        `• 💰 Found: +${resEvent.coins} Coins\n` +
        `• ✨ EXP: +${resEvent.xp}\n` +
        (resEvent.item ? `• 🎁 Discovered: ${SHOP_ITEMS[resEvent.item].name}\n` : "") +
        `• -25 Energy | -15 Hunger`;
      if (leveled) res += `\n🎉 LEVEL UP! Level ${state.pet.level}!`;
      return message.reply(res);
    }

    if (sub === "battle") {
      const now = Date.now();
      const cooldown = 10 * 60 * 1000;
      if (now - (state.cooldowns.battle || 0) < cooldown) {
        return message.reply(`⏳ Arena battle available in ${formatRemainingTime(cooldown - (now - state.cooldowns.battle))}.`);
      }
      if (state.pet.currentHp < 30) {
        return message.reply(`⚠️ ${state.pet.name} has low health (${state.pet.currentHp} HP). Heal before entering the colosseum!`);
      }

      state.cooldowns.battle = now;
      const enemyTier = Math.max(1, state.pet.level + (Math.random() > 0.5 ? 1 : -1));
      const enemyHp = 70 + (enemyTier * 14);
      const enemyAtk = 18 + (enemyTier * 4);
      const enemyDef = 8 + (enemyTier * 2);

      let playerHp = state.pet.currentHp;
      let oppHp = enemyHp;
      let logs = [];

      for (let round = 1; round <= 3; round++) {
        const pDmg = Math.max(8, getPetAttack(state.pet, state) - enemyDef + Math.floor(Math.random() * 6));
        oppHp -= pDmg;
        logs.push(`Round ${round}: ${state.pet.name} strikes for 💥 ${pDmg} DMG!`);
        if (oppHp <= 0) break;

        const eDmg = Math.max(6, enemyAtk - getPetDefense(state.pet, state) + Math.floor(Math.random() * 5));
        playerHp -= eDmg;
        logs.push(`Round ${round}: Rival Wild Beast counterattacks for ⚡ ${eDmg} DMG!`);
        if (playerHp <= 0) break;
      }

      state.pet.currentHp = Math.max(10, playerHp);
      let battleResult = "";
      if (oppHp <= 0 || playerHp > oppHp) {
        state.stats.wins += 1;
        const rewardCoins = 400 + (enemyTier * 30);
        const leveled = applyXp(state.pet, 65);
        if (state.stats.wins >= 25) state.pet.rank = "Diamond Master";
        else if (state.stats.wins >= 15) state.pet.rank = "Gold Gladiator";
        else if (state.stats.wins >= 5) state.pet.rank = "Silver Veteran";

        await usersData.set(senderID, {
          money: balance + rewardCoins,
          data: { ...userData.data, goatai_pet: state }
        });

        battleResult = `🏆 VICTORY!\n${logs.join("\n")}\n• 💰 +${rewardCoins} Coins\n• ✨ +65 EXP\n• Current Rank: ${state.pet.rank}`;
        if (leveled) battleResult += `\n🎉 LEVEL UP! Level ${state.pet.level}!`;
      } else {
        state.stats.losses += 1;
        await usersData.set(senderID, {
          data: { ...userData.data, goatai_pet: state }
        });
        battleResult = `💀 DEFEAT!\n${logs.join("\n")}\n${state.pet.name} was overpowered but gained hardened battle grit (+15 EXP).`;
        applyXp(state.pet, 15);
      }

      return message.reply(`⚔️ ═══════ RANKED COLISEUM ═══════ ⚔️\n${battleResult}`);
    }

    if (sub === "top") {
      const allUsers = await usersData.getAll();
      const petHolders = allUsers
        .filter(u => u.data?.goatai_pet?.pet)
        .map(u => ({
          name: u.name || "Tamer",
          petName: u.data.goatai_pet.pet.name,
          level: u.data.goatai_pet.pet.level,
          wins: u.data.goatai_pet.stats?.wins || 0,
          rank: u.data.goatai_pet.pet.rank || "Novice"
        }))
        .sort((a, b) => b.level !== a.level ? b.level - a.level : b.wins - a.wins)
        .slice(0, 10);

      if (petHolders.length === 0) {
        return message.reply("🏆 No pet masters registered yet!");
      }

      let lb = "🏆 ══════ TOP BEASTMASTERS LEADERBOARD ══════ 🏆\n";
      petHolders.forEach((p, i) => {
        lb += `${i + 1}. ${p.name} & 「${p.petName}」 - Lv.${p.level} | ${p.wins} Wins | ${p.rank}\n`;
      });
      return message.reply(lb);
    }

    // Default: Display Dashboard
    const profile = renderPetCard(state, state.pet, balance);
    const dashboardGuide =
      `\n\n🎮 Available Commands:\n` +
      `• ${prefix}pet shop - Buy items & gear\n` +
      `• ${prefix}pet care - Use items to heal & feed\n` +
      `• ${prefix}pet daily - Collect gold & rations\n` +
      `• ${prefix}pet train [atk/def] - Increase stats\n` +
      `• ${prefix}pet bond - Emotional care & karma\n` +
      `• ${prefix}pet adventure - Explore dungeons\n` +
      `• ${prefix}pet pray - Spiritual sanctuary healing\n` +
      `• ${prefix}pet battle - Arena matchmaking`;

    return message.reply(profile + dashboardGuide);
  },

  onReply: async function ({ api, event, Reply, message, usersData }) {
    const { senderID, body, messageID } = event;
    const session = activeSessions.get(Reply.messageID);
    if (!session) return;

    if (Date.now() > session.expiresAt) {
      activeSessions.delete(Reply.messageID);
      return message.reply("⌛ Session timed out. Please run the command again.");
    }

    if (senderID !== session.authorId) {
      return message.reply("⚠️ You are not the owner of this pet session.");
    }

    const userData = await usersData.get(senderID);
    const state = getOrCreatePetState(userData);
    const balance = userData.money || 0;

    if (session.type === "SHOP_BUY") {
      const parts = body.trim().split(/\s+/);
      const choice = parseInt(parts[0], 10);
      const qty = Math.max(1, parseInt(parts[1], 10) || 1);

      if (isNaN(choice) || choice < 1 || choice > session.indexMap.length) {
        return message.reply("❌ Invalid choice. Reply with item number and optional quantity (e.g., '1 2').");
      }

      const itemKey = session.indexMap[choice - 1];
      const item = SHOP_ITEMS[itemKey];
      const totalCost = item.cost * qty;

      if (balance < totalCost) {
        return message.reply(`❌ You do not have enough coins! Total cost: ${totalCost.toLocaleString()} Coins (You have: ${balance.toLocaleString()}).`);
      }

      state.inventory[itemKey] = (state.inventory[itemKey] || 0) + qty;
      await usersData.set(senderID, {
        money: balance - totalCost,
        data: { ...userData.data, goatai_pet: state }
      });

      activeSessions.delete(Reply.messageID);
      return message.reply(`✅ Purchased ${qty}x ${item.icon} ${item.name} for ${totalCost.toLocaleString()} coins!\nSupplies added to your inventory.`);
    }

    if (session.type === "CARE_USE") {
      const choice = parseInt(body.trim(), 10);
      if (isNaN(choice) || choice < 1 || choice > session.invKeys.length) {
        return message.reply("❌ Invalid selection. Reply with the number of the item you want to use.");
      }

      const itemKey = session.invKeys[choice - 1];
      const owned = state.inventory[itemKey] || 0;
      if (owned <= 0) {
        return message.reply("❌ You do not have any of this item left.");
      }

      const item = SHOP_ITEMS[itemKey];
      state.inventory[itemKey] -= 1;

      if (item.hunger) state.pet.hunger = clamp(state.pet.hunger + item.hunger);
      if (item.happiness) state.pet.happiness = clamp(state.pet.happiness + item.happiness);
      if (item.energy) state.pet.energy = clamp(state.pet.energy + item.energy);
      if (item.hp) state.pet.currentHp = clamp(state.pet.currentHp + item.hp, 0, getPetMaxHp(state.pet));

      if (item.type === "gear") {
        if (item.stat === "def") state.gear.collar = itemKey;
        if (item.stat === "atk") state.gear.weapon = itemKey;
      }

      await usersData.set(senderID, {
        data: { ...userData.data, goatai_pet: state }
      });

      activeSessions.delete(Reply.messageID);
      return message.reply(`✨ You gave ${item.icon} ${item.name} to ${state.pet.name}!\nCondition restored.`);
    }
  }
};
