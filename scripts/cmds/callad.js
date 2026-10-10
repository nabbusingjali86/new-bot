module.exports = {
	config: {
		name: "callad",
		version: "1.0.0",
		author: "Nabin | ©GoatAI",
		countDown: 5,
		role: 0,
		shortDescription: {
			en: "Contact bot admin"
		},
		description: {
			en: "Send a message or feedback directly to the bot admin/owner inbox with reply support."
		},
		category: "utility",
		guide: {
			en: "{pn} <your message> - Send a message or report to the bot admin"
		}
	},

	onStart: async function ({ api, args, message, event, usersData, threadsData, globalData }) {
		const { senderID, threadID, messageID, isGroup } = event;
		const adminBotList = globalData.adminBot || [];

		if (!args[0]) {
			return message.reply({
				body: `⚠️ Please provide a message to send to the admin.\n\n📖 Usage:\n${this.config.guide.en.replace("{pn}", message.prefix || "/")}`
			});
		}

		if (!adminBotList || adminBotList.length === 0) {
			return message.reply("⚠️ No bot admin/owner ID is configured in globalData.adminBot.");
		}

		const senderName = await usersData.getName(senderID) || "Facebook User";
		let threadName = "Direct Message";
		if (isGroup) {
			const threadInfo = await threadsData.get(threadID);
			threadName = threadInfo?.threadName || `Group ID: ${threadID}`;
		}

		const content = args.join(" ").trim();
		const alertText = `📩 [ CALL ADMIN REPORT ]\n` +
			`━━━━━━━━━━━━━━━━━━\n` +
			`👤 Sender: ${senderName}\n` +
			`🆔 User ID: ${senderID}\n` +
			`📍 Sent from: ${threadName} (${threadID})\n` +
			`⏰ Time: ${new Date().toLocaleString()}\n` +
			`━━━━━━━━━━━━━━━━━━\n` +
			`💬 Message:\n${content}\n\n` +
			`👉 Reply to this message to send an answer directly back to the user/thread.`;

		let sentCount = 0;

		for (const adminID of adminBotList) {
			try {
				const info = await api.sendMessage(alertText, adminID);
				global.GoatBot.onReply.set(info.messageID, {
					commandName: this.config.name,
					messageID: info.messageID,
					targetThreadID: threadID,
					targetSenderID: senderID,
					originalMessageID: messageID,
					senderName: senderName,
					type: "adminReply"
				});
				sentCount++;
			} catch (err) {
				// Continue attempting to deliver to remaining admins
			}
		}

		if (sentCount === 0) {
			return message.reply("❌ Failed to forward your message to the bot admin inbox. Please try again later.");
		}

		return message.reply(`✅ Your message has been successfully delivered to ${sentCount} admin inbox(es). Please wait for a reply!`);
	},

	onReply: async function ({ api, event, Reply, message, usersData, globalData }) {
		const { senderID, body, messageID } = event;
		const adminBotList = globalData.adminBot || [];

		if (Reply.type === "adminReply") {
			if (!adminBotList.includes(senderID)) {
				return message.reply("⚠️ Only bot admins can reply to this report.");
			}

			const adminName = await usersData.getName(senderID) || "Admin";
			const replyText = `📩 [ ADMIN REPLY ]\n` +
				`━━━━━━━━━━━━━━━━━━\n` +
				`👑 Admin: ${adminName}\n` +
				`💬 Message:\n${body || "No text provided"}\n` +
				`━━━━━━━━━━━━━━━━━━\n` +
				`👉 Reply to this message to continue the conversation with the admin.`;

			try {
				const sentInfo = await api.sendMessage(
					{
						body: replyText,
						mentions: [{ id: Reply.targetSenderID, tag: Reply.senderName }]
					},
					Reply.targetThreadID,
					Reply.originalMessageID
				);

				global.GoatBot.onReply.set(sentInfo.messageID, {
					commandName: this.config.name,
					messageID: sentInfo.messageID,
					targetAdminID: senderID,
					originalThreadID: Reply.targetThreadID,
					type: "userReply"
				});

				return message.reply("✅ Successfully sent your reply to the user!");
			} catch (err) {
				return message.reply(`❌ Could not deliver your reply. Error: ${err.message || err}`);
			}
		}

		if (Reply.type === "userReply") {
			const senderName = await usersData.getName(senderID) || "Facebook User";
			const followUpText = `📩 [ USER RESPONSE ]\n` +
				`━━━━━━━━━━━━━━━━━━\n` +
				`👤 From: ${senderName} (${senderID})\n` +
				`💬 Message:\n${body || "No text provided"}\n` +
				`━━━━━━━━━━━━━━━━━━\n` +
				`👉 Reply to this message to send another response back.`;

			try {
				const sentInfo = await api.sendMessage(followUpText, Reply.targetAdminID);
				global.GoatBot.onReply.set(sentInfo.messageID, {
					commandName: this.config.name,
					messageID: sentInfo.messageID,
					targetThreadID: event.threadID,
					targetSenderID: senderID,
					originalMessageID: messageID,
					senderName: senderName,
					type: "adminReply"
				});

				return message.reply("✅ Your reply has been forwarded to the admin!");
			} catch (err) {
				return message.reply(`❌ Failed to send reply to admin. Error: ${err.message || err}`);
			}
		}
	}
};
