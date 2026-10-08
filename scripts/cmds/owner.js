const fs = require("fs-extra");
const request = require("request");
const path = require("path");

module.exports = {
  config: {
    name: "owner",
    version: "2.0.7",
    author: "Nabin", 
    noprefix: "true",
    shortDescription: "Owner information with image",
    category: "Information",
    guide: {
      en: "owner"
    }
  },

  onStart: async function ({ api, event }) {
    const ownerText = 
`╭─ 👑 Oᴡɴᴇʀ Iɴғᴏ 👑 ─╮
│ 👤 Nᴀᴍᴇ       : Nabin Singjali Magar
│ 🧸 Nɪᴄᴋ       : Nabbu 
│ 🎂 Aɢᴇ        : 18
│ 💘 Rᴇʟᴀᴛɪᴏɴ : Sɪɴɢʟᴇ
│ 🎓 Pʀᴏғᴇssɪᴏɴ : Sᴛᴜᴅᴇɴᴛ
│ 📚 Eᴅᴜᴄᴀᴛɪᴏɴ : 12
│ 🏡 Lᴏᴄᴀᴛɪᴏɴ : Nepal palpa 
├─ 🔗 Cᴏɴᴛᴀᴄᴛ ─╮
│ 📘 Facebook  : https://www.facebook.com/nabin.mgrx.237081.
╰────────────────╯`;

    const cacheDir = path.join(__dirname, "cache");
    const mp4Path = path.join(cacheDir, "owner.mp4");

    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir);

    const mp4Link = "https://i.imgur.com/91u1cpz.mp4";

    const send = () => {
      api.sendMessage(
        {
          body: ownerText,
          attachment: fs.createReadStream(mp4Path)
        },
        event.threadID,
        () => fs.unlinkSync(mp4Path),
        event.messageID
      );
    };

    request(encodeURI(mp4Link))
      .pipe(fs.createWriteStream(mp4Path))
      .on("close", send);
  }
};
