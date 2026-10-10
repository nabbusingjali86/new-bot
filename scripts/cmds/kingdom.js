const activeSessions = new Map();

function getExpNeeded(level) {
	return Math.floor(100 * Math.pow(1.5, level - 1));
}

function getDefaultKingdom() {
	return {
		name: "Unnamed Realm",
		castleLevel: 1,
		gold: 250,
		xp: 0,
		level: 1,
		soldiers: 20,
		defenseTowers: 1,
		lastHarvest: 0,
		wins: 0,
		losses: 0
	};
}

async function getPlayerData(usersData, userID) {
	const user = await usersData.get(userID);
	const kingdomData = (user && user.data && user.data.goatai_kingdom)
		? { ...getDefaultKingdom(), ...user.data.goatai_kingdom }
		: getDefaultKingdom();
	return { user, kingdomData };
}

async function savePlayerData(usersData, userID, userRecord, kingdomData) {
	const existingUser = userRecord || (await usersData.get(userID)) || {};
	const currentData = existingUser.data || {};
	await usersData.set(userID, {
		...existingUser,
		data: {
			...currentData,
			goatai_kingdom: kingdomData
		}
	});
}

function addXP(kingdom, amount) {
	kingdom.xp += amount;
	let leveledUp = false;
	let needed = getExpNeeded(kingdom.level);

	while (kingdom.xp >= needed && kingdom.level < 50) {
		kingdom.xp -= needed;
		kingdom.level += 1;
		kingdom.gold += kingdom.level * 100;
		leveledUp = true;
		needed = getExpNeeded(kingdom.level);
	}

	return leveledUp;
}

module.exports = {
	config: {
		name: "kingdom",
		version: "1.0.0",
		author: "Aryan Chauhan | ©GoatAI",
		countDown: 5,
		role: 0,
		shortDescription: {
			en: "Empire building and warfare simulator"
		},
		description: {
			en: "Build your kingdom, upgrade your castle, recruit armies, raid rivals, harvest taxes, and rise as emperor."
		},
		category: "game",
		guide: {
			en: "{prefix}kingdom - Open interactive kingdom menu\n" +
				"{prefix}kingdom view [@mention/reply] - View kingdom profile\n" +
				"{prefix}kingdom harvest - Collect realm taxes and resources\n" +
				"{prefix}kingdom recruit <amount> - Recruit soldiers (10 gold each)\n" +
				"{prefix}kingdom upgrade - Upgrade castle defense and income\n" +
				"{prefix}kingdom raid [@mention/reply] - Raid another ruler or rival territory\n" +
				"{prefix}kingdom rename <name> - Rename your realm"
		}
	},

	onStart: async function ({ api, args, message, event, usersData, prefix }) {
		const { senderID, threadID, mentions, messageReply } = event;
		const subCommand = (args[0] || "").toLowerCase();

		const { user, kingdomData } = await getPlayerData(usersData, senderID);

		if (!subCommand) {
			const statusMsg = `👑 ═══ 〖 ${kingdomData.name.toUpperCase()} 〗 ═══ 👑\n` +
				`🏰 Castle Level: ${kingdomData.castleLevel} | Rank: Level ${kingdomData.level}\n` +
				`💰 Treasury: ${kingdomData.gold.toLocaleString()} Gold\n` +
				`⚔️ Army: ${kingdomData.soldiers.toLocaleString()} Soldiers\n` +
				`🛡️ Fortifications: ${kingdomData.defenseTowers} Watchtowers\n` +
				`📊 War Record: ${kingdomData.wins} Wins / ${kingdomData.losses} Defeats\n` +
				`✨ EXP: ${kingdomData.xp}/${getExpNeeded(kingdomData.level)}\n\n` +
				`📜 Reply with an option number to act:\n` +
				`1. 🌾 Harvest Tax & Supplies\n` +
				`2. 🛡️ Upgrade Castle & Defenses\n` +
				`3. ⚔️ Recruit Soldiers (100 soldiers = 1,000g)\n` +
				`4. 🏴‍☠️ Dispatch Expedition Raid (PvE)\n` +
				`5. 📜 View Full Command Guide`;

			const sent = await message.reply(statusMsg);
			const sessionKey = `${threadID}_${sent.messageID}`;

			const timeout = setTimeout(() => {
				activeSessions.delete(sessionKey);
			}, 60000);

			activeSessions.set(sessionKey, {
				userID: senderID,
				action: "MENU",
				timeout
			});

			global.GoatBot.onReply.set(sent.messageID, {
				commandName: this.config.name,
				messageID: sent.messageID,
				author: senderID
			});
			return;
		}

		if (subCommand === "view" || subCommand === "profile") {
			let targetID = senderID;
			if (mentions && Object.keys(mentions).length > 0) {
				targetID = Object.keys(mentions)[0];
			} else if (messageReply && messageReply.senderID) {
				targetID = messageReply.senderID;
			} else if (args[1] && !isNaN(args[1])) {
				targetID = args[1];
			}

			const targetPlayer = await getPlayerData(usersData, targetID);
			const targetData = targetPlayer.kingdomData;
			const targetName = (mentions && mentions[targetID])
				? mentions[targetID].replace("@", "")
				: (targetID === senderID ? "Your Realm" : `Ruler (${targetID})`);

			return message.reply(
				`👑 ═══ 〖 ${targetData.name.toUpperCase()} 〗 ═══ 👑\n` +
				`👤 Monarch: ${targetName}\n` +
				`🏰 Castle Level: ${targetData.castleLevel} (Empire Rank ${targetData.level})\n` +
				`💰 Treasury: ${targetData.gold.toLocaleString()} Gold\n` +
				`⚔️ Garrison: ${targetData.soldiers.toLocaleString()} Soldiers\n` +
				`🛡️ Defense Towers: ${targetData.defenseTowers}\n` +
				`⚔️ Battle History: ${targetData.wins}W - ${targetData.losses}L\n` +
				`✨ EXP: ${targetData.xp}/${getExpNeeded(targetData.level)}`
			);
		}

		if (subCommand === "harvest") {
			const now = Date.now();
			const cooldown = 5 * 60 * 1000;
			const timePassed = now - kingdomData.lastHarvest;

			if (timePassed < cooldown) {
				const remainingSec = Math.ceil((cooldown - timePassed) / 1000);
				return message.reply(`⏳ Your granaries and treasuries are replenishing. Return in ${remainingSec}s to collect taxes.`);
			}

			const baseGold = 100 * kingdomData.castleLevel;
			const bonus = Math.floor(Math.random() * 50) * kingdomData.level;
			const totalGained = baseGold + bonus;
			const xpGained = 20 * kingdomData.castleLevel;

			kingdomData.gold += totalGained;
			kingdomData.lastHarvest = now;
			const leveled = addXP(kingdomData, xpGained);

			await savePlayerData(usersData, senderID, user, kingdomData);

			let harvestMsg = `🌾 Harvest Complete! Collected ${totalGained.toLocaleString()} gold and earned ${xpGained} XP.`;
			if (leveled) {
				harvestMsg += `\n🎉 LEVEL UP! Your empire advanced to Level ${kingdomData.level}! Earned a promotion bonus!`;
			}
			return message.reply(harvestMsg);
		}

		if (subCommand === "recruit") {
			const amount = parseInt(args[1], 10);
			if (isNaN(amount) || amount <= 0) {
				return message.reply(`⚠️ Usage: ${prefix}kingdom recruit <positive number>\nCost: 10 gold per soldier.`);
			}

			const cost = amount * 10;
			if (kingdomData.gold < cost) {
				return message.reply(`❌ Insufficient funds. Recruiting ${amount.toLocaleString()} soldiers requires ${cost.toLocaleString()} gold. Current balance: ${kingdomData.gold.toLocaleString()} gold.`);
			}

			kingdomData.gold -= cost;
			kingdomData.soldiers += amount;
			await savePlayerData(usersData, senderID, user, kingdomData);

			return message.reply(`⚔️ Successfully enlisted ${amount.toLocaleString()} soldiers for ${cost.toLocaleString()} gold!\nTotal Army: ${kingdomData.soldiers.toLocaleString()} troops.`);
		}

		if (subCommand === "upgrade") {
			const upgradeCost = kingdomData.castleLevel * 500;
			if (kingdomData.gold < upgradeCost) {
				return message.reply(`❌ Castle upgrade to Level ${kingdomData.castleLevel + 1} requires ${upgradeCost.toLocaleString()} gold. You have ${kingdomData.gold.toLocaleString()} gold.`);
			}

			kingdomData.gold -= upgradeCost;
			kingdomData.castleLevel += 1;
			kingdomData.defenseTowers += 1;
			const leveled = addXP(kingdomData, 50);

			await savePlayerData(usersData, senderID, user, kingdomData);

			let upMsg = `🏰 Castle upgraded to Level ${kingdomData.castleLevel}!\n🛡️ Defense watchtowers increased to ${kingdomData.defenseTowers}.`;
			if (leveled) {
				upMsg += `\n🎉 Realm achieved empire level ${kingdomData.level}!`;
			}
			return message.reply(upMsg);
		}

		if (subCommand === "rename") {
			const newName = args.slice(1).join(" ").trim().slice(0, 30);
			if (!newName) {
				return message.reply(`⚠️ Usage: ${prefix}kingdom rename <New Realm Name> (Max 30 characters).`);
			}

			kingdomData.name = newName;
			await savePlayerData(usersData, senderID, user, kingdomData);
			return message.reply(`📜 Royal Decree: Your domain is now officially known as "${newName}"!`);
		}

		if (subCommand === "raid") {
			let targetID = null;
			if (mentions && Object.keys(mentions).length > 0) {
				targetID = Object.keys(mentions)[0];
			} else if (messageReply && messageReply.senderID) {
				targetID = messageReply.senderID;
			}

			if (targetID && targetID !== senderID) {
				if (kingdomData.soldiers < 10) {
					return message.reply("⚔️ You must command at least 10 soldiers to launch a PvP invasion!");
				}

				const targetRecord = await getPlayerData(usersData, targetID);
				const enemyKingdom = targetRecord.kingdomData;

				const myPower = kingdomData.soldiers * (1 + kingdomData.level * 0.05);
				const enemyDefense = enemyKingdom.soldiers * 0.9 + (enemyKingdom.defenseTowers * 25);

				const winRoll = Math.random() * (myPower + enemyDefense);
				const won = winRoll <= myPower;

				if (won) {
					const loot = Math.min(Math.floor(enemyKingdom.gold * 0.35), 5000) || 50;
					const troopLoss = Math.floor(kingdomData.soldiers * (Math.random() * 0.15 + 0.05));
					const enemyLoss = Math.floor(enemyKingdom.soldiers * (Math.random() * 0.3 + 0.1));

					kingdomData.soldiers = Math.max(0, kingdomData.soldiers - troopLoss);
					enemyKingdom.soldiers = Math.max(0, enemyKingdom.soldiers - enemyLoss);
					kingdomData.gold += loot;
					enemyKingdom.gold = Math.max(0, enemyKingdom.gold - loot);
					kingdomData.wins += 1;
					enemyKingdom.losses += 1;

					const leveled = addXP(kingdomData, 40);

					await savePlayerData(usersData, senderID, user, kingdomData);
					await savePlayerData(usersData, targetID, targetRecord.user, enemyKingdom);

					let res = `⚔️ VICTORY! Your forces breached ${enemyKingdom.name}!\n` +
						`💰 Plundered: ${loot.toLocaleString()} gold\n` +
						`🪖 Your casualties: ${troopLoss} soldiers\n` +
						`💀 Enemy casualties: ${enemyLoss} defenders`;
					if (leveled) res += `\n🎉 Your glory elevated you to Level ${kingdomData.level}!`;
					return message.reply(res);
				} else {
					const troopLoss = Math.floor(kingdomData.soldiers * (Math.random() * 0.25 + 0.1));
					kingdomData.soldiers = Math.max(0, kingdomData.soldiers - troopLoss);
					kingdomData.losses += 1;
					enemyKingdom.wins += 1;

					await savePlayerData(usersData, senderID, user, kingdomData);
					await savePlayerData(usersData, targetID, targetRecord.user, enemyKingdom);

					return message.reply(
						`🛡️ DEFEAT! The defenses of ${enemyKingdom.name} held firm against your assault.\n` +
						`🪖 Fallen soldiers: ${troopLoss}`
					);
				}
			} else {
				if (kingdomData.soldiers < 5) {
					return message.reply("⚔️ You require at least 5 soldiers to raid uncivilized outposts.");
				}

				const enemyPower = Math.floor(Math.random() * 25) + (kingdomData.level * 8);
				const myPower = kingdomData.soldiers + (kingdomData.castleLevel * 5);

				if (myPower >= enemyPower) {
					const loot = Math.floor(Math.random() * 150) + (kingdomData.level * 30);
					const casualties = Math.floor(Math.random() * 3) + 1;
					kingdomData.soldiers = Math.max(0, kingdomData.soldiers - casualties);
					kingdomData.gold += loot;
					kingdomData.wins += 1;
					const leveled = addXP(kingdomData, 15);

					await savePlayerData(usersData, senderID, user, kingdomData);

					let raidMsg = `🏴‍☠️ Expedition Victorious! You plundered an outlaw settlement.\n` +
						`💰 Loot: ${loot.toLocaleString()} gold\n` +
						`🪖 Casualties: ${casualties} soldiers`;
					if (leveled) raidMsg += `\n🎉 Rank Up! Empire reached Level ${kingdomData.level}!`;
					return message.reply(raidMsg);
				} else {
					const casualties = Math.floor(Math.random() * 5) + 2;
					kingdomData.soldiers = Math.max(0, kingdomData.soldiers - casualties);
					kingdomData.losses += 1;
					await savePlayerData(usersData, senderID, user, kingdomData);

					return message.reply(`💀 Expedition Repelled! The raiders counterattacked, costing you ${casualties} soldiers.`);
				}
			}
		}

		return message.reply(
			`⚠️ Unknown royal command.\nUsage:\n` +
			`• ${prefix}kingdom harvest\n` +
			`• ${prefix}kingdom upgrade\n` +
			`• ${prefix}kingdom recruit <amount>\n` +
			`• ${prefix}kingdom raid [@mention]\n` +
			`• ${prefix}kingdom rename <name>\n` +
			`• ${prefix}kingdom view`
		);
	},

	onReply: async function ({ api, event, Reply, usersData, message, prefix }) {
		const { senderID, body, threadID, messageReply } = event;
		const originalMessageID = Reply.messageID || (messageReply && messageReply.messageID);
		const sessionKey = `${threadID}_${originalMessageID}`;
		const session = activeSessions.get(sessionKey);

		if (!session) return;
		if (session.userID !== senderID) {
			return message.reply("⚠️ Only the sovereign who invoked this realm decree may select an option.");
		}

		clearTimeout(session.timeout);
		activeSessions.delete(sessionKey);

		const choice = (body || "").trim();
		const { user, kingdomData } = await getPlayerData(usersData, senderID);

		switch (choice) {
			case "1": {
				const now = Date.now();
				const cooldown = 5 * 60 * 1000;
				const timePassed = now - kingdomData.lastHarvest;

				if (timePassed < cooldown) {
					const remainingSec = Math.ceil((cooldown - timePassed) / 1000);
					return message.reply(`⏳ Granaries are replenishing. Return in ${remainingSec}s to collect taxes.`);
				}

				const baseGold = 100 * kingdomData.castleLevel;
				const bonus = Math.floor(Math.random() * 50) * kingdomData.level;
				const totalGained = baseGold + bonus;
				const xpGained = 20 * kingdomData.castleLevel;

				kingdomData.gold += totalGained;
				kingdomData.lastHarvest = now;
				const leveled = addXP(kingdomData, xpGained);

				await savePlayerData(usersData, senderID, user, kingdomData);

				let harvestMsg = `🌾 Harvested ${totalGained.toLocaleString()} gold and gained ${xpGained} XP.`;
				if (leveled) harvestMsg += `\n🎉 Rank Up! Empire reached Level ${kingdomData.level}!`;
				return message.reply(harvestMsg);
			}

			case "2": {
				const upgradeCost = kingdomData.castleLevel * 500;
				if (kingdomData.gold < upgradeCost) {
					return message.reply(`❌ Castle upgrade to Level ${kingdomData.castleLevel + 1} requires ${upgradeCost.toLocaleString()} gold. Current balance: ${kingdomData.gold.toLocaleString()} gold.`);
				}

				kingdomData.gold -= upgradeCost;
				kingdomData.castleLevel += 1;
				kingdomData.defenseTowers += 1;
				const leveled = addXP(kingdomData, 50);

				await savePlayerData(usersData, senderID, user, kingdomData);

				let upMsg = `🏰 Castle upgraded to Level ${kingdomData.castleLevel}! Watchtowers: ${kingdomData.defenseTowers}.`;
				if (leveled) upMsg += `\n🎉 Emperor rank elevated to Level ${kingdomData.level}!`;
				return message.reply(upMsg);
			}

			case "3": {
				const recruitCount = 100;
				const cost = recruitCount * 10;
				if (kingdomData.gold < cost) {
					return message.reply(`❌ Enlisting a battalion of 100 soldiers requires ${cost.toLocaleString()} gold. Current treasury: ${kingdomData.gold.toLocaleString()} gold.`);
				}

				kingdomData.gold -= cost;
				kingdomData.soldiers += recruitCount;
				await savePlayerData(usersData, senderID, user, kingdomData);

				return message.reply(`⚔️ Enlisted 100 soldiers into your royal army! Total forces: ${kingdomData.soldiers.toLocaleString()} soldiers.`);
			}

			case "4": {
				if (kingdomData.soldiers < 5) {
					return message.reply("⚔️ At least 5 soldiers are needed to launch an expedition.");
				}

				const enemyPower = Math.floor(Math.random() * 25) + (kingdomData.level * 8);
				const myPower = kingdomData.soldiers + (kingdomData.castleLevel * 5);

				if (myPower >= enemyPower) {
					const loot = Math.floor(Math.random() * 150) + (kingdomData.level * 30);
					const casualties = Math.floor(Math.random() * 3) + 1;
					kingdomData.soldiers = Math.max(0, kingdomData.soldiers - casualties);
					kingdomData.gold += loot;
					kingdomData.wins += 1;
					const leveled = addXP(kingdomData, 15);

					await savePlayerData(usersData, senderID, user, kingdomData);

					let raidMsg = `🏴‍☠️ Expedition Successful! Sacked enemy barbarian base.\n💰 Gold: +${loot.toLocaleString()}\n🪖 Lost soldiers: ${casualties}`;
					if (leveled) raidMsg += `\n🎉 Rank Up! Empire reached Level ${kingdomData.level}!`;
					return message.reply(raidMsg);
				} else {
					const casualties = Math.floor(Math.random() * 5) + 2;
					kingdomData.soldiers = Math.max(0, kingdomData.soldiers - casualties);
					kingdomData.losses += 1;
					await savePlayerData(usersData, senderID, user, kingdomData);

					return message.reply(`💀 Expedition crushed! The barbarians routed your detachment, eliminating ${casualties} troops.`);
				}
			}

			case "5": {
				return message.reply(
					`📜 ═══ KINGDOM GUIDE ═══ 📜\n` +
					`• harvest: Collect hourly gold and experience.\n` +
					`• upgrade: Fortify defenses and multiply resource yield.\n` +
					`• recruit <count>: Train soldiers for 10 gold each.\n` +
					`• raid [@tag]: Wage war against rival players or uncharted lands.\n` +
					`• rename <name>: Issue a royal proclamation to rename your kingdom.`
				);
			}

			default:
				return message.reply("⚠️ Invalid selection. Please enter a number between 1 and 5.");
		}
	}
};
