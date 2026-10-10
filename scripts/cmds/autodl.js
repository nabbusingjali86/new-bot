const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const URL_REGEX = /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,})/gi;

const SUPPORTED_DOMAINS = [
	"tiktok.com",
	"facebook.com",
	"fb.watch",
	"instagram.com",
	"youtube.com",
	"youtu.be",
	"twitter.com",
	"x.com",
	"threads.net",
	"capcut.com",
	"pinterest.com",
	"pin.it"
];

function isSupportedUrl(url) {
	try {
		const parsed = new URL(url);
		return SUPPORTED_DOMAINS.some(domain => parsed.hostname.includes(domain));
	} catch (e) {
		return false;
	}
}

async function fetchMediaStream(downloadUrl, cacheDir, ext = "mp4") {
	await fs.ensureDir(cacheDir);
	const filePath = path.join(cacheDir, `autodl_${Date.now()}_${Math.floor(Math.random() * 10000)}.${ext}`);
	const response = await axios({
		url: downloadUrl,
		method: "GET",
		responseType: "stream",
		timeout: 60000,
		headers: {
			"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
		}
	});

	const writer = fs.createWriteStream(filePath);
	response.data.pipe(writer);

	return new Promise((resolve, reject) => {
		writer.on("finish", () => resolve(filePath));
		writer.on("error", (err) => {
			fs.remove(filePath).catch(() => {});
			reject(err);
		});
	});
}

async function resolveVideo(targetUrl) {
	const apiUrl = `[https://api.tiklydown.eu.org/api/download?url=$](https://api.tiklydown.eu.org/api/download?url=$){encodeURIComponent(targetUrl)}`;
	try {
		const res = await axios.get(apiUrl, { timeout: 20000 });
		const data = res.data;

		if (data && data.videoUrl) {
			return {
				title: data.title || "Downloaded Video",
				videoUrl: data.videoUrl
			};
		}
		if (data && data.video && data.video.noWatermark) {
			return {
				title: data.title || "Downloaded Video",
				videoUrl: data.video.noWatermark
			};
		}
	} catch (e) {
		// Fallback to secondary universal downloader
	}

	const fallbackApi = `[https://all-media-downloader-api.vercel.app/api/download?url=$](https://all-media-downloader-api.vercel.app/api/download?url=$){encodeURIComponent(targetUrl)}`;
	try {
		const res = await axios.get(fallbackApi, { timeout: 20000 });
		const data = res.data;
		if (data && data.url) {
			return {
				title: data.title || "Downloaded Video",
				videoUrl: data.url
			};
		}
		if (data && data.result && data.result.video) {
			return {
				title: data.result.title || "Downloaded Video",
				videoUrl: data.result.video
			};
		}
	} catch (e) {
		// Both endpoints failed
	}

	return null;
}

module.exports = {
	config: {
		name: "autodl",
		version: "1.0.0",
		author: "nabin | ©GoatAI",
		countDown: 5,
		role: 0,
		shortDescription: {
			en: "Download videos from links shared in chat"
		},
		description: {
			en: "Detects and downloads videos automatically or manually from supported shared links (TikTok, Facebook, Instagram, YouTube, etc.)"
		},
		category: "media",
		guide: {
			en: "{prefix}autodl [url] - Download a video directly"
		}
	},

	onStart: async function ({ api, event, args, message }) {
		const cacheDir = path.join(__dirname, "cache");
		let targetUrl = args[0];

		if (!targetUrl && event.messageReply && event.messageReply.body) {
			const matched = event.messageReply.body.match(URL_REGEX);
			if (matched && matched.length > 0) {
				targetUrl = matched[0];
			}
		}

		if (!targetUrl) {
			return message.reply("Please provide a valid media URL or reply to a message containing a link.");
		}

		if (!isSupportedUrl(targetUrl)) {
			return message.reply("The provided URL is not supported or recognized.");
		}

		const waitMsg = await message.reply("Fetching media, please wait...");
		let filePath;

		try {
			const videoData = await resolveVideo(targetUrl);
			if (!videoData || !videoData.videoUrl) {
				if (waitMsg && waitMsg.messageID) {
					api.unsendMessage(waitMsg.messageID).catch(() => {});
				}
				return message.reply("Unable to resolve a downloadable video stream from the link.");
			}

			filePath = await fetchMediaStream(videoData.videoUrl, cacheDir);

			if (waitMsg && waitMsg.messageID) {
				api.unsendMessage(waitMsg.messageID).catch(() => {});
			}

			await message.reply({
				body: `Title: ${videoData.title}`,
				attachment: fs.createReadStream(filePath)
			});
		} catch (err) {
			if (waitMsg && waitMsg.messageID) {
				api.unsendMessage(waitMsg.messageID).catch(() => {});
			}
			return message.reply("An error occurred while downloading the media.");
		} finally {
			if (filePath && (await fs.pathExists(filePath))) {
				await fs.remove(filePath).catch(() => {});
			}
		}
	},

	onReply: async function ({ api, event, message }) {
		if (!event.body) return;
		const matched = event.body.match(URL_REGEX);
		if (!matched || matched.length === 0) return;

		const targetUrl = matched[0];
		if (!isSupportedUrl(targetUrl)) return;

		const cacheDir = path.join(__dirname, "cache");
		let filePath;

		try {
			const videoData = await resolveVideo(targetUrl);
			if (!videoData || !videoData.videoUrl) return;

			filePath = await fetchMediaStream(videoData.videoUrl, cacheDir);

			await message.reply({
				body: `Title: ${videoData.title}`,
				attachment: fs.createReadStream(filePath)
			});
		} catch (err) {
			// Fail silently during passive reply processing
		} finally {
			if (filePath && (await fs.pathExists(filePath))) {
				await fs.remove(filePath).catch(() => {});
			}
		}
	},

	onReaction: async function () {
		return;
	}
};
