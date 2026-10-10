module.exports = {
  config: {
    name: "pet",
    aliases: [],
    version: "1.0.0",
    author: "Nabin | ©GoatAI",
    countDown: 3,
    role: 0,
    shortDescription: {
      en: "Adopt, feed, train, battle, and manage your virtual pet."
    },
    description: {
      en: "A complete virtual pet game featuring adoption, feeding, training, shopping, battles, and leaderboards."
    },
    category: "game",
    guide: {
      en: "{prefix}pet - Open main interactive menu\n" +
          "{prefix}pet status - View pet status\n" +
          "{prefix}pet shop - Browse the pet food & item shop\n" +
          "{prefix}pet feed - Feed your pet\n" +
          "{prefix}pet train - Train your pet to earn XP\n" +
          "{prefix}pet battle - Challenge a wild pet to battle\n" +
          "{prefix}pet top - Pet level leaderboard"
    }
  },

  onStart: async function ({ api, event, args, message, usersData, prefix }) {
    const { senderID, threadID } = event;
    const subCommand = (args[0] || "").toLowerCase();

    const userData = await usersData.get(senderID);
    const petState = (userData && userData.data && userData.data.goatai_pet) || null;

    if (!subCommand) {
      if (!petState || !petState.hasPet) {
        const text = "🐾 𝗪𝗘𝗟𝗖𝗢𝗠𝗘 𝗧𝗢 𝗣𝗘𝗧 𝗪𝗢𝗥𝗟𝗗 🐾\n" +
          "─────────────────────\n" +
          "You don't have a pet yet! Choose one to adopt:\n\n" +
          "1. 🐶 Doggo (Loyal & Balanced)\n" +
          "2. 🐱 Kitty (Agile & High Crit)\n" +
          "3. 🐲 Dragon (High Power & Stamina)\n\n" +
          "Reply with the number (1-3) to adopt your companion!";

        return message.reply(text, (err, info) => {
          if (err) return;
          global.GoatBot.onReply.set(info.messageID, {
            commandName: "pet",
            messageID: info.messageID,
            authorID: senderID,
            type: "adopt_select"
          });
        });
      }

      const menuText = `🐾 𝗣𝗘𝗧 𝗠𝗔𝗜𝗡 𝗠𝗘𝗡𝗨 🐾\n` +
        `─────────────────────\n` +
        `Pet Name: ${petState.name} (${petState.type})\n` +
        `Level: ${petState.level} | XP: ${petState.xp}/${petState.level * 100}\n` +
        `HP: ${petState.hp}/${petState.maxHp} | Hunger: ${petState.hunger}/100\n` +
        `Coins: ${petState.coins || 0} 🪙\n` +
        `─────────────────────\n` +
        `Reply with an option number:\n` +
        `1. 🍖 Feed Pet\n` +
        `2. 🏋️ Train Pet\n` +
        `3. ⚔️ Wild Battle\n` +
        `4. 🛒 Pet Shop\n` +
        `5. 📊 Detailed Status\n` +
        `6. 🏆 Leaderboard`;

      return message.reply(menuText, (err, info) => {
        if (err) return;
        global.GoatBot.onReply.set(info.messageID, {
          commandName: "pet",
          messageID: info.messageID,
          authorID: senderID,
          type: "menu_select"
        });
      });
    }

    if (subCommand === "status") {
      if (!petState || !petState.hasPet) return message.reply("❌ You do not have a pet yet. Use `" + prefix + "pet` to adopt one!");
      return module.exports.showStatus(message, petState);
    }

    if (subCommand === "shop") {
      return module.exports.showShop(message, senderID);
    }

    if (subCommand === "feed") {
      if (!petState || !petState.hasPet) return message.reply("❌ You do not have a pet yet. Use `" + prefix + "pet` to adopt one!");
      return module.exports.feedPet(message, usersData, senderID, petState);
    }

    if (subCommand === "train") {
      if (!petState || !petState.hasPet) return message.reply("❌ You do not have a pet yet. Use `" + prefix + "pet` to adopt one!");
      return module.exports.trainPet(message, usersData, senderID, petState);
    }

    if (subCommand === "battle") {
      if (!petState || !petState.hasPet) return message.reply("❌ You do not have a pet yet. Use `" + prefix + "pet` to adopt one!");
      return module.exports.battleWild(message, usersData, senderID, petState);
    }

    if (subCommand === "top" || subCommand === "leaderboard") {
      return module.exports.showLeaderboard(message, usersData);
    }

    return message.reply(`❌ Unknown option. Use \`${prefix}pet\` to view the main menu.`);
  },

  onReply: async function ({ api, event, Reply, message, usersData }) {
    const { senderID, body } = event;
    const { authorID, messageID, type } = Reply;

    if (senderID !== authorID) return;

    const trimmed = (body || "").trim();
    const userData = await usersData.get(senderID);
    const petState = (userData && userData.data && userData.data.goatai_pet) || null;

    if (type === "adopt_select") {
      const choice = parseInt(trimmed, 10);
      let selectedType = "";
      let defaultName = "";
      let bonusHp = 100;
      let bonusAtk = 15;

      if (choice === 1) {
        selectedType = "Doggo";
        defaultName = "Buddy";
        bonusHp = 110;
        bonusAtk = 14;
      } else if (choice === 2) {
        selectedType = "Kitty";
        defaultName = "Milo";
        bonusHp = 95;
        bonusAtk = 18;
      } else if (choice === 3) {
        selectedType = "Dragon";
        defaultName = "Ignis";
        bonusHp = 130;
        bonusAtk = 16;
      } else {
        return message.reply("❌ Invalid choice. Please reply with 1, 2, or 3.");
      }

      const newPet = {
        hasPet: true,
        type: selectedType,
        name: defaultName,
        level: 1,
        xp: 0,
        hp: bonusHp,
        maxHp: bonusHp,
        attack: bonusAtk,
        hunger: 80,
        coins: 100,
        inventory: {
          biscuit: 3,
          meat: 1,
          potion: 1
        },
        wins: 0,
        losses: 0,
        lastTrain: 0,
        lastFeed: 0
      };

      await module.exports.savePetData(usersData, senderID, userData, newPet);
      global.GoatBot.onReply.delete(messageID);
      return message.reply(`🎉 Congratulations! You adopted a ${selectedType} named "${defaultName}"!\nYou received 100 🪙 and starter supplies to begin your journey.`);
    }

    if (type === "menu_select") {
      const option = parseInt(trimmed, 10);
      global.GoatBot.onReply.delete(messageID);

      if (!petState || !petState.hasPet) {
        return message.reply("❌ You don't have a pet yet.");
      }

      switch (option) {
        case 1:
          return module.exports.feedPet(message, usersData, senderID, petState);
        case 2:
          return module.exports.trainPet(message, usersData, senderID, petState);
        case 3:
          return module.exports.battleWild(message, usersData, senderID, petState);
        case 4:
          return module.exports.showShop(message, senderID);
        case 5:
          return module.exports.showStatus(message, petState);
        case 6:
          return module.exports.showLeaderboard(message, usersData);
        default:
          return message.reply("❌ Invalid selection. Please choose an option from 1 to 6.");
      }
    }

    if (type === "shop_buy") {
      const choice = parseInt(trimmed, 10);
      if (isNaN(choice) || choice < 1 || choice > 3) {
        return message.reply("❌ Invalid selection. Reply with 1, 2, or 3 to purchase.");
      }

      const catalog = {
        1: { id: "biscuit", name: "Biscuits", cost: 20 },
        2: { id: "meat", name: "Premium Meat", cost: 50 },
        3: { id: "potion", name: "Health Potion", cost: 40 }
      };

      const selected = catalog[choice];
      if ((petState.coins || 0) < selected.cost) {
        return message.reply(`❌ Not enough coins! You need ${selected.cost} 🪙 but only have ${petState.coins || 0} 🪙.`);
      }

      petState.coins -= selected.cost;
      petState.inventory = petState.inventory || {};
      petState.inventory[selected.id] = (petState.inventory[selected.id] || 0) + 1;

      await module.exports.savePetData(usersData, senderID, userData, petState);
      global.GoatBot.onReply.delete(messageID);

      return message.reply(`🛍️ Successfully bought 1x ${selected.name} for ${selected.cost} 🪙!\nRemaining coins: ${petState.coins} 🪙`);
    }
  },

  savePetData: async function (usersData, userID, userData, petState) {
    const currentUser = userData || (await usersData.get(userID)) || {};
    const safeData = currentUser.data || {};
    await usersData.set(userID, {
      ...currentUser,
      data: {
        ...safeData,
        goatai_pet: petState
      }
    });
  },

  showStatus: function (message, pet) {
    const text = `📊 𝗣𝗘𝗧 𝗦𝗧𝗔𝗧𝗨𝗦: ${pet.name.toUpperCase()} 📊\n` +
      `─────────────────────\n` +
      `Species: ${pet.type}\n` +
      `Level: ${pet.level} (XP: ${pet.xp}/${pet.level * 100})\n` +
      `Health: ${pet.hp}/${pet.maxHp}\n` +
      `Attack Power: ${pet.attack}\n` +
      `Hunger Level: ${pet.hunger}/100\n` +
      `Coins: ${pet.coins || 0} 🪙\n` +
      `Battle Record: ${pet.wins || 0}W / ${pet.losses || 0}L\n` +
      `─────────────────────\n` +
      `🎒 Inventory:\n` +
      `• Biscuits: ${pet.inventory?.biscuit || 0}\n` +
      `• Premium Meat: ${pet.inventory?.meat || 0}\n` +
      `• Health Potions: ${pet.inventory?.potion || 0}`;
    return message.reply(text);
  },

  showShop: function (message, senderID) {
    const shopText = `🛒 𝗣𝗘𝗧 𝗜𝗧𝗘𝗠 𝗦𝗛𝗢𝗣 🛒\n` +
      `─────────────────────\n` +
      `1. 🍪 Biscuit (+20 Hunger) - 20 🪙\n` +
      `2. 🥩 Premium Meat (+50 Hunger, +10 HP) - 50 🪙\n` +
      `3. 🧪 Health Potion (Full HP Restore) - 40 🪙\n` +
      `─────────────────────\n` +
      `Reply with the item number (1-3) to buy!`;

    return message.reply(shopText, (err, info) => {
      if (err) return;
      global.GoatBot.onReply.set(info.messageID, {
        commandName: "pet",
        messageID: info.messageID,
        authorID: senderID,
        type: "shop_buy"
      });
    });
  },

  feedPet: async function (message, usersData, senderID, pet) {
    const userData = await usersData.get(senderID);
    pet.inventory = pet.inventory || {};

    if (pet.hunger >= 100) {
      return message.reply(`🍖 ${pet.name} is already completely full! (${pet.hunger}/100)`);
    }

    if ((pet.inventory.meat || 0) > 0) {
      pet.inventory.meat -= 1;
      pet.hunger = Math.min(100, pet.hunger + 50);
      pet.hp = Math.min(pet.maxHp, pet.hp + 10);
      await module.exports.savePetData(usersData, senderID, userData, pet);
      return message.reply(`🥩 You fed ${pet.name} Premium Meat! Hunger is now ${pet.hunger}/100 and restored 10 HP.`);
    }

    if ((pet.inventory.biscuit || 0) > 0) {
      pet.inventory.biscuit -= 1;
      pet.hunger = Math.min(100, pet.hunger + 20);
      await module.exports.savePetData(usersData, senderID, userData, pet);
      return message.reply(`🍪 You fed ${pet.name} a Biscuit! Hunger is now ${pet.hunger}/100.`);
    }

    return message.reply("❌ You don't have any food in your inventory! Visit the shop with `{prefix}pet shop` to purchase food.");
  },

  trainPet: async function (message, usersData, senderID, pet) {
    const now = Date.now();
    const cooldown = 60 * 1000;
    if (now - (pet.lastTrain || 0) < cooldown) {
      const waitSec = Math.ceil((cooldown - (now - pet.lastTrain)) / 1000);
      return message.reply(`⏳ ${pet.name} is tired from training! Please wait ${waitSec}s.`);
    }

    if (pet.hunger < 15) {
      return message.reply(`⚠️ ${pet.name} is too hungry to train (${pet.hunger}/100). Feed your pet first!`);
    }

    const userData = await usersData.get(senderID);
    pet.hunger = Math.max(0, pet.hunger - 15);
    pet.lastTrain = now;

    const gainedXp = Math.floor(Math.random() * 25) + 25;
    const earnedCoins = Math.floor(Math.random() * 15) + 10;
    pet.xp += gainedXp;
    pet.coins = (pet.coins || 0) + earnedCoins;

    let leveledUp = false;
    const requiredXp = pet.level * 100;
    if (pet.xp >= requiredXp) {
      pet.level += 1;
      pet.xp -= requiredXp;
      pet.maxHp += 15;
      pet.hp = pet.maxHp;
      pet.attack += 3;
      leveledUp = true;
    }

    await module.exports.savePetData(usersData, senderID, userData, pet);

    let msg = `🏋️ ${pet.name} completed intense training!\n` +
      `+${gainedXp} XP | +${earnedCoins} 🪙 | -15 Hunger\n`;
    if (leveledUp) {
      msg += `\n🌟 LEVEL UP! ${pet.name} reached Level ${pet.level}!\nMax HP +15, Attack +3, and fully recovered health!`;
    }
    return message.reply(msg);
  },

  battleWild: async function (message, usersData, senderID, pet) {
    if (pet.hp <= 20) {
      return message.reply(`⚠️ ${pet.name}'s HP is too low to battle (${pet.hp}/${pet.maxHp})! Heal or feed your pet first.`);
    }

    const userData = await usersData.get(senderID);
    const wildLevel = Math.max(1, pet.level + (Math.floor(Math.random() * 3) - 1));
    let wildHp = wildLevel * 45;
    const wildAttack = wildLevel * 10 + 2;

    let myHp = pet.hp;
    const log = [];

    while (myHp > 0 && wildHp > 0) {
      const myDmg = Math.max(5, pet.attack + Math.floor(Math.random() * 6) - 2);
      wildHp -= myDmg;
      if (wildHp <= 0) break;

      const wildDmg = Math.max(4, wildAttack + Math.floor(Math.random() * 5) - 2);
      myHp -= wildDmg;
    }

    pet.hp = Math.max(0, myHp);

    if (wildHp <= 0) {
      const rewardCoins = wildLevel * 25;
      const rewardXp = wildLevel * 30;
      pet.coins = (pet.coins || 0) + rewardCoins;
      pet.xp += rewardXp;
      pet.wins = (pet.wins || 0) + 1;

      let levelText = "";
      const reqXp = pet.level * 100;
      if (pet.xp >= reqXp) {
        pet.level += 1;
        pet.xp -= reqXp;
        pet.maxHp += 15;
        pet.hp = pet.maxHp;
        pet.attack += 3;
        levelText = `\n🌟 LEVEL UP! Reached Level ${pet.level}!`;
      }

      await module.exports.savePetData(usersData, senderID, userData, pet);
      return message.reply(
        `⚔️ 𝗩𝗜𝗖𝗧𝗢𝗥𝗬! ⚔️\n` +
        `Your ${pet.name} defeated the Wild Beast (Lv.${wildLevel})!\n` +
        `Remaining HP: ${pet.hp}/${pet.maxHp}\n` +
        `Rewards: +${rewardCoins} 🪙 | +${rewardXp} XP` + levelText
      );
    } else {
      pet.losses = (pet.losses || 0) + 1;
      await module.exports.savePetData(usersData, senderID, userData, pet);
      return message.reply(
        `💀 𝗗𝗘𝗙𝗘𝗔𝗧! 💀\n` +
        `The wild beast overpowered ${pet.name}!\n` +
        `Current HP: ${pet.hp}/${pet.maxHp}. Rest and heal up before trying again.`
      );
    }
  },

  showLeaderboard: async function (message, usersData) {
    try {
      const allUsers = await usersData.getAll();
      const petHolders = [];

      for (const user of allUsers) {
        if (user && user.data && user.data.goatai_pet && user.data.goatai_pet.hasPet) {
          petHolders.push({
            name: user.name || "Pet Trainer",
            petName: user.data.goatai_pet.name,
            level: user.data.goatai_pet.level || 1,
            wins: user.data.goatai_pet.wins || 0
          });
        }
      }

      if (petHolders.length === 0) {
        return message.reply("🏆 No pet trainers found yet. Be the first to adopt one!");
      }

      petHolders.sort((a, b) => b.level - a.level || b.wins - a.wins);
      const topList = petHolders.slice(0, 10);

      let boardText = `🏆 𝗧𝗢𝗣 𝗣𝗘𝗧 𝗧𝗥𝗔𝗜𝗡𝗘𝗥𝗦 🏆\n─────────────────────\n`;
      topList.forEach((entry, idx) => {
        boardText += `${idx + 1}. ${entry.name} - ${entry.petName} (Lv.${entry.level} | ${entry.wins}W)\n`;
      });

      return message.reply(boardText.trim());
    } catch (err) {
      return message.reply("❌ Unable to load leaderboard at this moment.");
    }
  }
};
