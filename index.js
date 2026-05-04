const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { spawn } = require('child_process');
const qrcode = require('qrcode-terminal');

const GRUP_UTAMA = '120363408426078537@g.us';
const GRUP_KEDUA = '120363426296094605@g.us';

const TARGET_GROUP_IDS = new Set([GRUP_UTAMA, GRUP_KEDUA]);

// Regex dipersingkat (lebih cepat)
const linkRegex = /(dana\.id|link\.dana\.id|gopay\.co\.id|shopee\.co\.id)[^\s]*/gi;

// Cache ultra ringan
const activeLinks = new Set();
const CACHE_TTL = 5000; // dipercepat jadi 5 detik

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'fatal' }), // lebih ringan dari silent
        connectTimeoutMs: 20000,
        keepAliveIntervalMs: 5000,
        getMessage: async () => null
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
        if (qr) {
            qrcode.generate(qr, { small: true });
            console.log('Scan QR');
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== 401) {
                setTimeout(startBot, 1000); // reconnect lebih cepat
            }
        }

        if (connection === 'open') {
            console.log('⚡ BOT SIAP SUPER CEPAT');
        }
    });

    sock.ev.on('messages.upsert', ({ messages, type }) => {
        if (type !== 'notify') return;

        const msg = messages[0];
        if (!msg?.message) return;

        const from = msg.key.remoteJid;
        if (!TARGET_GROUP_IDS.has(from)) return;

        const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text;

        if (!text) return;

        // FAST FILTER (tanpa toLowerCase global)
        if (
            text.indexOf('dana') === -1 &&
            text.indexOf('gopay') === -1 &&
            text.indexOf('shopee') === -1
        ) return;

        const matches = text.match(linkRegex);
        if (!matches) return;

        for (let i = 0; i < matches.length; i++) {
            let link = matches[i].startsWith('http')
                ? matches[i]
                : 'https://' + matches[i];

            if (activeLinks.has(link)) continue;

            activeLinks.add(link);
            setTimeout(() => activeLinks.delete(link), CACHE_TTL);

            // ⚡ FIRE & FORGET (tanpa blocking)
            spawn('termux-open-url', [link], {
                detached: true,
                stdio: 'ignore'
            }).unref();

            console.log('🚀', link);
        }
    });
}

startBot();