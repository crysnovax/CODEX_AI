const axios = require('axios');

module.exports = {
    name: 'jid',
    alias: ['getjid', 'id', 'whois', 'getid'],
    desc: 'Extract JID from user, group, channel, or URL',
    category: 'Utility',
    usage: '.jid [reply/mention/url] or .jid in group/channel',
    reactions: {
        start: '🔍',
        success: '🐾'
    },

    execute: async (sock, m, { args, prefix, reply, isGroup, isChannel }) => {
        
        let targetJid = null;
        let targetType = 'Unknown';
        let extraInfo = {};

        // Method 1: Check quoted message
        if (m.quoted && m.quoted.sender) {
            targetJid = m.quoted.sender;
            targetType = 'Quoted User';
            extraInfo.quotedMsg = m.quoted.mtype || 'message';
        }
        
        // Method 2: Check mentioned users
        else if (m.mentionedJid && m.mentionedJid.length > 0) {
            targetJid = m.mentionedJid[0];
            targetType = 'Mentioned User';
            if (m.mentionedJid.length > 1) {
                extraInfo.totalMentions = m.mentionedJid.length;
            }
        }
        
        // Method 3: Check if command has args (URL or number)
        else if (args && args.length > 0) {
            const input = args.join(' ').trim();
            
            // Check if it's a WhatsApp URL
            const waUrlMatch = input.match(/(?:https?:\/\/)?(?:chat\.whatsapp\.com\/|whatsapp\.com\/channel\/)?([a-zA-Z0-9_-]{20,})/);
            const waMeMatch = input.match(/(?:https?:\/\/)?wa\.me\/(\d+)/);
            const waNumberMatch = input.match(/(?:https?:\/\/)?api\.whatsapp\.com\/send\?phone=(\d+)/);
            
            if (waUrlMatch) {
                // Group or Channel invite link
                const code = waUrlMatch[1];
                try {
                    // Try to get group info from invite code
                    const groupInfo = await sock.groupGetInviteInfo(code).catch(() => null);
                    if (groupInfo) {
                        targetJid = groupInfo.id;
                        targetType = 'Group (from invite)';
                        extraInfo.groupName = groupInfo.subject;
                        extraInfo.participants = groupInfo.size;
                    } else {
                        // Might be channel
                        targetJid = `${code}@newsletter`;
                        targetType = 'Channel (from invite)';
                    }
                } catch {
                    targetJid = `${code}@g.us`;
                    targetType = 'Group/Channel (from invite)';
                }
            }
            else if (waMeMatch || waNumberMatch) {
                // wa.me link
                const number = (waMeMatch || waNumberMatch)[1];
                targetJid = `${number}@s.whatsapp.net`;
                targetType = 'User (from wa.me)';
            }
            else if (input.includes('@')) {
                // Direct JID input
                targetJid = input;
                targetType = 'Direct JID';
            }
            else if (/^\d+$/.test(input)) {
                // Plain number
                targetJid = `${input}@s.whatsapp.net`;
                targetType = 'User (from number)';
            }
        }
        
        // Method 4: Current chat (group/channel)
        else if (isGroup && m.chat) {
            targetJid = m.chat;
            targetType = 'Current Group';
            try {
                const meta = await sock.groupMetadata(m.chat);
                extraInfo.name = meta.subject;
                extraInfo.participants = meta.participants.length;
                extraInfo.owner = meta.owner;
            } catch {}
        }
        
        // Method 5: Current channel
        else if (isChannel && m.chat) {
            targetJid = m.chat;
            targetType = 'Current Channel';
        }
        
        // Method 6: Sender themselves
        else if (m.sender) {
            targetJid = m.sender;
            targetType = 'Yourself';
        }

        // If no JID found
        if (!targetJid) {
            return reply(
                `✘ _*Could not extract JID*_\n\n` +
                `*Usage:*\n` +
                `• ${prefix}jid *(in group/channel)*\n` +
                `• ${prefix}jid @user *(mention)*\n` +
                `• ${prefix}jid *(reply to message)*\n` +
                `• ${prefix}jid https://chat.whatsapp.com/xxx *(group link)*\n` +
                `• ${prefix}jid https://whatsapp.com/channel/xxx *(channel link)*\n` +
                `• ${prefix}jid https://wa.me/1234567890 *(wa.me link)*`
            );
        }

        // Clean JID for display
        const cleanJid = targetJid.split(':')[0]; // Remove device suffix
        const number = cleanJid.split('@')[0];
        
        // Determine server type
        let serverType = 'Unknown';
        if (cleanJid.endsWith('@s.whatsapp.net')) serverType = 'User/Personal';
        else if (cleanJid.endsWith('@g.us')) serverType = 'Group';
        else if (cleanJid.endsWith('@newsletter')) serverType = 'Channel/Newsletter';
        else if (cleanJid.endsWith('@broadcast')) serverType = 'Status/Broadcast';
        else if (cleanJid.includes('@')) serverType = cleanJid.split('@')[1];

        // Try to get name
        let displayName = number;
        try {
            // Check store
            const contact = sock.store?.contacts?.get?.(cleanJid);
            if (contact?.notify) displayName = contact.notify;
            else if (contact?.name) displayName = contact.name;
            else {
                const fetched = await sock.getName(cleanJid);
                if (fetched && fetched !== cleanJid) displayName = fetched;
            }
        } catch {}

        // Build response
        let response = `╭─❍ *JID EXTRACTOR* 🔍\n`;
        response += `│\n`;
        response += `│ *Type:* ${targetType}\n`;
        response += `│ *Category:* ${serverType}\n`;
        response += `│\n`;
        response += `│ *Number/ID:* ${number}\n`;
        response += `│ *Full JID:*\n`;
        response += `│ \`\`\`${cleanJid}\`\`\`\n`;
        
        if (displayName !== number) {
            response += `│ *Name:* ${displayName}\n`;
        }
        
        // Add extra info
        if (extraInfo.name) {
            response += `│ *Title:* ${extraInfo.name}\n`;
        }
        if (extraInfo.participants) {
            response += `│ *Members:* ${extraInfo.participants}\n`;
        }
        if (extraInfo.owner) {
            response += `│ *Owner:* ${extraInfo.owner.split('@')[0]}\n`;
        }
        if (extraInfo.totalMentions) {
            response += `│ *Total Mentions:* ${extraInfo.totalMentions}\n`;
        }
        
        response += `╰──────────────────`;

        // Copy button
        await sock.sendMessage(m.chat, {
            text: response,
            contextInfo: {
                externalAdReply: {
                    title: 'JID Extracted',
                    body: number,
                    renderLargerThumbnail: false
                }
            },
            buttons: [
                {
                    buttonId: 'copy',
                    buttonText: { displayText: '📋 Copy JID' },
                    type: 1,
                    nativeFlowInfo: {
                        name: 'cta_copy',
                        paramsJson: JSON.stringify({
                            display_text: '📋 Copy JID',
                            copy_code: cleanJid
                        })
                    }
                }
            ],
            headerType: 1
        }, { quoted: m });
    }
};
