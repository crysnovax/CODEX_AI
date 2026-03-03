const axios = require('axios');
const FormData = require('form-data');

module.exports = {
    name: 'rembg',
    alias: ['removebg', 'nobg', 'bgremove'],
    desc: 'Remove background from replied image',
    category: 'Tools',
    usage: '.rembg (reply to an image)',
    owner: false,

    execute: async (sock, m, { reply }) => {

        if (!m.quoted) {
            return reply('╭─❍ *𝗖𝗢𝗗𝗘𝗫 AI V2.0*\n│ ✘ Reply to an image.\n╰──────────────────');
        }

        const quoted = m.quoted;
        const mtype = quoted.type || quoted.mtype || '';

        if (!['imageMessage', 'image'].includes(mtype)) {
            return reply('╭─❍ *𝗖𝗢𝗗𝗘𝗫 AI V2.0*\n│ ✘ Please reply to an image only.\n╰──────────────────');
        }

        try {
            await reply('╭─❍ *𝗖𝗢𝗗𝗘𝗫 AI V2.0*\n│ ✪ Removing background...\n╰──────────────────');

            const buffer = await m.quoted.download();

            if (!buffer || buffer.length < 100) {
                return reply('╭─❍ *𝗖𝗢𝗗𝗘𝗫 AI V2.0*\n│ ✘ Failed to download image.\n╰──────────────────');
            }

            const form = new FormData();
            form.append('image_file', buffer, {
                filename: 'image.jpg',
                contentType: 'image/jpeg'
            });
            form.append('size', 'auto');

            const response = await axios.post(
                'https://api.remove.bg/v1.0/removebg',
                form,
                {
                    headers: {
                        ...form.getHeaders(),
                        'X-Api-Key': 'wPFjD5dk6JXo6P5UoxtH6dJW'
                    },
                    responseType: 'arraybuffer',
                    timeout: 30000
                }
            );

            await sock.sendMessage(m.key.remoteJid, {
                image: Buffer.from(response.data),
                mimetype: 'image/png',
                caption: `╭─❍ *𝗖𝗢𝗗𝗘𝗫 AI V2.0*\n│ ✦ Background removed successfully.\n╰──────────────────`
            }, { quoted: m });

        } catch (err) {

            let msg = '╭─❍ *𝗖𝗢𝗗𝗘𝗫 AI V2.0*\n│ ✘ Failed to remove background.';

            if (err.response?.status === 402) {
                msg += '\n│ ✦ API credits exhausted.';
            } else if (err.response?.status === 401) {
                msg += '\n│ ✦ Invalid API key.';
            } else if (err.code === 'ECONNABORTED') {
                msg += '\n│ ✦ Request timed out.';
            }

            msg += '\n╰──────────────────';

            await reply(msg);
        }
    }
};
