const axios = require('axios');
const validUrl = require('valid-url');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const API_ENDPOINT = "https://shizukaai.onrender.com/chat";
const CLEAR_ENDPOINT = API_ENDPOINT.replace(/\/+$/, '').replace(/\/chat$/, '/chat/clear');
const TMP_DIR = path.join(__dirname, 'tmp');

if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const processedMessages = new Set();
const markProcessed = (messageID) => {
  if (!messageID) return false;
  if (processedMessages.has(messageID)) return true;
  processedMessages.add(messageID);
  setTimeout(() => processedMessages.delete(messageID), 15000);
  return false;
};

const downloadFile = async (url, extension) => {
  const filePath = path.join(TMP_DIR, `${uuidv4()}.${extension}`);
  const dataUrlMatch = typeof url === 'string'
    ? url.match(/^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i)
    : null;

  if (dataUrlMatch) {
    fs.writeFileSync(filePath, Buffer.from(dataUrlMatch[2], 'base64'));
    return filePath;
  }

  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 420000,
    maxContentLength: 25 * 1024 * 1024,
    maxBodyLength: 25 * 1024 * 1024
  });
  fs.writeFileSync(filePath, Buffer.from(response.data));
  return filePath;
};

const hasImageAttachment = (event) => {
  const attachments = event?.messageReply?.attachments || event?.attachments || [];
  return attachments.some(attachment =>
    ['photo', 'image'].includes(String(attachment?.type || '').toLowerCase()) ||
    String(attachment?.mimeType || '').toLowerCase().startsWith('image/')
  );
};

const isClearCommand = (value) =>
  /^(clear|reset|clean)(\s+(history|all|chat|memory|session))?$/i.test(
    String(value || '').trim()
  );

const resetConversation = async (api, event, message) => {
  api.setMessageReaction("♻️", event.messageID, () => {}, true);
  try {
    await axios.delete(`${CLEAR_ENDPOINT}/${encodeURIComponent(event.senderID)}`, {
      timeout: 30000
    });
    return message.reply(`✅ Conversation reset for UID: ${event.senderID}`);
  } catch (error) {
    console.error('❌ Reset Error:', error.message);
    return message.reply("❌ Reset failed. Try again.");
  }
};

const handleAIRequest = async (api, event, userInput, message) => {
  if (markProcessed(event.messageID)) return;

  const userId = String(event.senderID);
  let messageContent = userInput || '';
  const imageUrls = [];
  const addImageUrls = (attachments = []) => {
    for (const attachment of Array.isArray(attachments) ? attachments : []) {
      const isImage =
        ['photo', 'image'].includes(String(attachment?.type || '').toLowerCase()) ||
        String(attachment?.mimeType || '').toLowerCase().startsWith('image/');
      const url = attachment?.url ||
        attachment?.previewUrl ||
        attachment?.largePreviewUrl ||
        null;
      if (isImage && url && !imageUrls.includes(url)) {
        imageUrls.push(url);
      }
    }
  };

  api.setMessageReaction("⏳", event.messageID, () => {}, true);

  if (event.messageReply) {
    const replyData = event.messageReply;
    const currentBotID = String(
      global.GoatBot?.botID ||
      api.getCurrentUserID()
    );

    if (String(replyData.senderID) !== currentBotID && replyData.body) {
      const trimmedReply = replyData.body.length > 300
        ? replyData.body.slice(0, 300) + "..."
        : replyData.body;
      messageContent += `\n\n📌 Context:\n"${trimmedReply}"`;
    }

    addImageUrls(replyData.attachments);
  }
  addImageUrls(event.attachments);

  const imageCommand = /^(edit|retouch|restyle|transform|remove background|replace background|change background|describe|explain|analyze|image)\b/i.test(messageContent);
  const urlMatches = [...messageContent.matchAll(/https?:\/\/[^\s]+/g)].map(match => match[0]);
  const imageUrlsFromMessage = urlMatches.filter(url => {
    const imageFileUrl = /\.(?:png|jpe?g|gif|webp|bmp|svg)(?:[?#]|$)/i.test(url);
    return validUrl.isWebUri(url) && (imageCommand || imageFileUrl);
  });
  for (const url of imageUrlsFromMessage) {
    if (!imageUrls.includes(url)) imageUrls.push(url);
  }
  messageContent = messageContent
    .split(/\s+/)
    .filter(token => !imageUrlsFromMessage.includes(token))
    .join(' ')
    .trim();

  if (!messageContent.trim() && !imageUrls.length) {
    api.setMessageReaction("❌", event.messageID, () => {}, true);
    return message.reply("💬 Provide a message or attach or reply to an image.");
  }

  try {
    const response = await axios.post(
      API_ENDPOINT,
      {
        uid: userId,
        message: messageContent,
        image_url: imageUrls[0] || null,
        image_urls: imageUrls
      },
      {
        timeout: 420000,
        maxContentLength: 30 * 1024 * 1024
      }
    );

    const {
      reply: textReply,
      image_url: generatedImageUrl,
      isImage,
      music_data: musicData,
      video_data: videoData,
      lyrics_data: lyricsData,
      error: apiReportedError
    } = response.data;

    let finalReply = textReply || (
      apiReportedError
        ? '⚠️ The AI service could not complete that request.'
        : '✅ AI Response:'
    );
    const attachments = [];
    const tempFiles = [];

    if (generatedImageUrl && (isImage || typeof generatedImageUrl === 'string')) {
      try {
        const filePath = await downloadFile(generatedImageUrl, 'jpg');
        tempFiles.push(filePath);
        attachments.push(fs.createReadStream(filePath));
      } catch {
        finalReply += '\n🖼️ Image download failed.';
      }
    }

    if (musicData?.downloadUrl) {
      try {
        const filePath = await downloadFile(musicData.downloadUrl, 'mp3');
        tempFiles.push(filePath);
        attachments.push(fs.createReadStream(filePath));
      } catch {
        finalReply += '\n🎵 Music download failed.';
      }
    }

    if (videoData?.downloadUrl) {
      try {
        const filePath = await downloadFile(videoData.downloadUrl, 'mp4');
        tempFiles.push(filePath);
        attachments.push(fs.createReadStream(filePath));
      } catch {
        finalReply += '\n🎬 Video download failed.';
      }
    }

    if (lyricsData) {
      try {
        const maxLength = 1500;
        let lyricsText = lyricsData.lyrics || '';
        if (lyricsText.length > maxLength) {
          lyricsText = lyricsText.substring(0, maxLength) + '... [truncated]';
        }
        finalReply += `\n\n🎵 Lyrics for "${lyricsData.track_name}":\n${lyricsText}`;

        const thumbnailUrl = lyricsData.thumbnail || lyricsData.artwork_url;
        if (thumbnailUrl) {
          try {
            const filePath = await downloadFile(thumbnailUrl, 'jpg');
            tempFiles.push(filePath);
            attachments.push(fs.createReadStream(filePath));
          } catch (error) {
            console.error('❌ Lyrics thumbnail download failed:', error.message);
            finalReply += '\n🖼️ Lyrics thumbnail download failed.';
          }
        }
      } catch {
        finalReply += '\n📝 Lyrics processing failed.';
      }
    }

    const payload = { body: finalReply };
    if (attachments.length > 0) {
      payload.attachment = attachments;
    }

    await message.reply(payload);

    setTimeout(() => {
      for (const filePath of tempFiles) {
        try {
          fs.unlinkSync(filePath);
        } catch (_) {}
      }
    }, 60000);

    api.setMessageReaction("✅", event.messageID, () => {}, true);
  } catch (error) {
    console.error("❌ API Error:", error.response?.data || error.message);
    api.setMessageReaction("❌", event.messageID, () => {}, true);

    let errorMessage = "⚠️ AI Error:\n\n";
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      errorMessage += "⏱️ Timeout. Try again.";
    } else if (error.response?.status === 429) {
      errorMessage += "🚦 Too many requests. Slow down.";
    } else {
      errorMessage += "❌ Unexpected error: " + (error.message || 'No details');
    }

    return message.reply(errorMessage);
  }
};

module.exports = {
  config: {
    name: 'ai',
    version: '2.7.0',
    author: 'Aryan Chauhan',
    countDown: 5,
    role: 0,
    shortDescription: 'Interact with AI assistant',
    description: 'Advanced AI with chat, image analysis/editing/generation, music, video, and lyrics',
    category: 'ai',
    guide: {
      en: '{pn} [your message]\n • 🤖 Chat and image analysis\n • 🎨 Generate: "imagine a calm wallpaper"\n • 🖌️ Edit a replied image: "edit the background to a sunset"\n • 🎵 Music: "sing [song name]"\n • 🎬 Video: "video [search]"\n • ⬇️ Download: "dl [video URL]"\n • 📝 Lyrics: "lyrics [song name]"\n • 🔄 "clear" or "reset" clears conversation'
    }
  },

  onStart: async function ({ api, event, args, message }) {
    const userInput = args.join(' ').trim();

    if (!userInput && !hasImageAttachment(event)) {
      return message.reply("❗ Please enter a message or reply to an image.");
    }

    if (isClearCommand(userInput)) {
      return resetConversation(api, event, message);
    }

    return handleAIRequest(api, event, userInput, message);
  }
};
