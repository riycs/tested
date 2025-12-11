const fs = require('fs');
const path = require('path');
const util = require("util");
const {
    exec
} = require("child_process");
const axios = require("axios");
const chalk = require("chalk");
const moment = require("moment-timezone");
const ms = require("parse-ms");
const toMs = require("ms");
const baileys = require("baileys");

const fetch = (...args) =>
    import('node-fetch').then(({
        default: fetch
    }) => fetch(...args));


const {
    formatPhone,
    randomNomor,
    toRupiah,
    pickRandom,
    getRandom,
    getBuffer,
    parseMention,
    sleep
} = require("../lib/function");

let groupMetadata = {};
let groupName = "";
let participant = [];
let groupAdmin = [];
let groupMember = [];
let isAdmin = false;
let isBotAdmin = false;

moment.tz.setDefault('Asia/Jakarta').locale('id');

module.exports = sock = async (sock, m, chatUpdate, store) => {
    try {

        const body = ((m.mtype === 'conversation') ? m.message.conversation :
            (m.mtype == 'imageMessage') ? m.message.imageMessage.caption :
            (m.mtype == 'videoMessage') ? m.message.videoMessage.caption :
            (m.mtype == 'extendedTextMessage') ? m.message.extendedTextMessage.text :
            (m.mtype == 'reactionMessage') ? m.message.reactionMessage.text :
            (m.mtype == 'buttonsResponseMessage') ? m.message.buttonsResponseMessage.selectedButtonId :
            (m.mtype == 'listResponseMessage') ? m.message.listResponseMessage.singleSelectReply.selectedRowId :
            (m.mtype == 'templateButtonReplyMessage') ? m.message.templateButtonReplyMessage.selectedId :
            (m.mtype == 'interactiveResponseMessage' && m.quoted) ? (m.message.interactiveResponseMessage?.nativeFlowResponseMessage ? JSON.parse(m.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson).id : '') :
            (m.mtype == 'messageContextInfo') ? (m.message.buttonsResponseMessage?.selectedButtonId || m.message.listResponseMessage?.singleSelectReply.selectedRowId || '') :
            (m.mtype == 'editedMessage') ? (m.message.editedMessage?.message?.protocolMessage?.editedMessage?.extendedTextMessage?.text || m.message.editedMessage?.message?.protocolMessage?.editedMessage?.conversation || '') :
            (m.mtype == 'protocolMessage') ? (m.message.protocolMessage?.editedMessage?.extendedTextMessage?.text || m.message.protocolMessage?.editedMessage?.conversation || m.message.protocolMessage?.editedMessage?.imageMessage?.caption || m.message.protocolMessage?.editedMessage?.videoMessage?.caption || '') : '') || '';

        const pushname = m.pushName || "Guest";
        const botNumber = await sock.decodeJid(sock.user.id);
        const senderJid = m.sender;

        const prefixRegex = /^[°•π÷×¶∆£¢€¥®™+✓_=|/~!?#%^&.©^]/;
        const prefix = prefixRegex.test(body) ? body.match(prefixRegex)[0] : "#";

        const command = body.toLowerCase().split(" ")[0] || "";
        const isCmd = command.startsWith(prefix);
        const args = body.trim().split(" ");
        const isValidCommand = isCmd && args[0]?.length > 1;
        const text = body.slice(command.length + 1).trim();
        const quoted = m.quoted || m;

        if (m.isGroup) {
            try {
                groupMetadata = await sock.groupMetadata(m.chat);
                groupName = groupMetadata.subject;
                participant = groupMetadata.participants || [];
                groupMember = participant;
                groupAdmin = participant
                    .filter(p => p.admin !== null)
                    .map(p => p.id);
                isAdmin = groupAdmin.includes(senderJid);
                isBotAdmin = groupAdmin.includes(botNumber);
            } catch (e) {
                console.error("Gagal ambil metadata grup:", e);
            }
        }

        const isOwner = global.ownerNumber
            .map(num => num.replace(/\D/g, '') + '@s.whatsapp.net')
            .includes(senderJid);
        const isUser = global.db.pendaftar.includes(senderJid);

        // Public/self
        if (!global.options.public && !isOwner) return;

        // Log
        if (isValidCommand && !m.key.fromMe) {
            const number = senderJid.split('@')[0];
            const name = pushname || number;
            const chatName = m.isGroup ? groupName : 'Private';
                console.log(
                    chalk.black(chalk.bgWhite('⤿ Name')), chalk.black(chalk.bgGreen(name)),
                    '\n' + chalk.black(chalk.bgWhite('⤿ Number')), chalk.black(chalk.bgGreen(formatPhone(number))),
                    '\n' + chalk.black(chalk.bgWhite('⤿ Chat')), chalk.black(chalk.bgYellow(chatName)),
                    '\n' + chalk.black(chalk.bgWhite('⤿ Command')), chalk.black(chalk.bgGreen(command))
                );
        }

        switch (command) {

            /* MAIN MENU */

            case prefix + "help":
            case prefix + "menu": {
                const teks = `${prefix}sticker
${prefix}stickerwm
${prefix}toimage
x evalcode
$ exec`
                m.reply(teks);
            }
            break;

            /* CONVERT MENU */

            case prefix + "s":
            case prefix + "stiker":
            case prefix + "sticker": {
                if (!(m.isImage || m.isVideo)) {
                    return m.reply(`Kirim atau Reply gambar/video (maks 8 detik) dengan caption: ${command}`);
                }
                if (m.isVideo && quoted.seconds > 8) {
                    return m.reply("Maksimal durasi video adalah 8 detik!");
                }
                try {
                    const media = await quoted.download();
                    const file = m.isImage ?
                        await sock.sendImageAsSticker(m.chat, media, m, {
                            packname: global.sticker.packName,
                            author: global.sticker.author
                        }) :
                        await sock.sendVideoAsSticker(m.chat, media, m, {
                            packname: global.sticker.packName,
                            author: global.sticker.author
                        });
                } catch (err) {
                    m.reply(global.mess.error);
                }
            }
            break;

            case prefix + "wm":
            case prefix + "swm":
            case prefix + "stikerwm":
            case prefix + "stickerwm": {
                if (!(m.isImage || m.isVideo)) {
                    return m.reply(`Kirim atau Reply gambar/video (maks 8 detik) dengan caption: ${command} Packname|Author`);
                }
                if (m.isVideo && quoted.seconds > 8) {
                    return m.reply("Maksimal durasi video adalah 8 detik!");
                }
                const [packname = "", author = ""] = text.split(".").map(v => v.trim());
                if (!packname) {
                    return m.reply(`Contoh: ${command} ${global.wm.footer}.by Riy`);
                }
                try {
                    const media = await quoted.download();
                    const file = m.isImage ?
                        await sock.sendImageAsSticker(m.chat, media, m, {
                            packname,
                            author
                        }) :
                        await sock.sendVideoAsSticker(m.chat, media, m, {
                            packname,
                            author
                        });
                } catch (err) {
                    m.reply(global.mess.error);
                }
            }
            break;

            case prefix + "toimg":
            case prefix + "toimage": {
                if (!m.isSticker || m.isAnimated) {
                    return m.reply(`Reply sticker *gambar* (bukan animasi) dengan caption: ${command}`);
                }
                m.reply(global.mess.wait);
                try {
                    const media = await quoted.download();
                    const inputPath = `./tmp/${getRandom('.webp')}`;
                    const outputPath = `./tmp/${getRandom('.png')}`;
                    fs.writeFileSync(inputPath, media);
                    exec(`ffmpeg -i ${inputPath} ${outputPath}`, async (err) => {
                        fs.unlinkSync(inputPath);
                        if (err) return m.reply("Gagal konversi ke gambar.");
                        const buffer = fs.readFileSync(outputPath);
                        await sock.sendMessage(m.chat, {
                            image: buffer,
                            caption: "Sticker berhasil dikonversi ke gambar."
                        }, {
                            quoted: m
                        });
                        fs.unlinkSync(outputPath);

                    });
                } catch (err) {
                    m.reply(global.mess.error);
                }
            }
            break;


            default:

                if (body.startsWith('x')) {
                    if (!isOwner) return;
                    try {
                        let evaled = await eval(body.slice(2));
                        if (typeof evaled !== 'string') evaled = util.inspect(evaled);
                        m.reply(evaled);
                    } catch (err) {
                        m.reply(String(err));
                    }
                }

                if (body.startsWith('$')) {
                    if (!isOwner) return;
                    const commandExec = body.slice(2).trim();
                    if (commandExec === 'rm -rf *') return;
                    exec(commandExec, (err, stdout, stderr) => {
                        if (err) return m.reply(`Error:\n${err.message}`);
                        if (stderr) return m.reply(`Stderr:\n${stderr}`);
                        if (stdout) return m.reply(`Output:\n${stdout}`);
                    });
                }

        }
    } catch (err) {
        sock.sendMessage(global.ownerNumber[0] + "@s.whatsapp.net", {
            text: util.format(err)
        });
    }

}

let file = require.resolve(__filename);
fs.watchFile(file, () => {
    fs.unwatchFile(file);
    console.log('\x1b[0;32m' + __filename + ' \x1b[1;32mupdated!\x1b[0m');
    delete require.cache[file];
    require(file);
});