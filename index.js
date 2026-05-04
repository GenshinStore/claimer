// ===== IMPORT =====
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const { exec } = require('child_process');

// ===== CONFIG =====
const GRUP_UTAMA = '120363408426078537@g.us';
const GRUP_KEDUA = '120363426296094605@g.us';
const TARGET_GROUP_IDS = new Set([GRUP_UTAMA, GRUP_KEDUA]);

// Domain target (tanpa regex biar super cepat)
const DOMAINS = ['dana.id', 'link.dana.id', 'gopay.co.id', 'shopee.co.id'];

// Cache anti duplicate
const activeLinks = new Set();

// ===== FUNCTION PARSE LINK SUPER CEPAT =====
function extractLinks(text) {
    const results = [];

    for (let i = 0; i < DOMAINS.length; i++) {
        const domain = DOMAINS[i];
        let idx = text.indexOf(domain);

        while (idx !== -1) {
            let end = text.indexOf(' ', idx);
            if (end === -1) end = text.length;

            let link = text.slice(idx, end);

            if (!link.startsWith('http')) {
                link = 'https://' + link;
            }

            results.push(link);
            idx = text.indexOf(domain, idx + 1);
        }
    }

    return results;
}

// ===== START BOT =====
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),

        connectTimeoutMs: 15000,
        keepAliveIntervalMs: 4000,

        markOnlineOnConnect: false,
        syncFullHistory: false,
        emitOwnEvents: false,

        getMessage: async () => null
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
        if (qr) {
            qrcode.generate(qr, { small: true });
            console.log('Scan QR...');
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;

            if (reason !== 401) {
                setTimeout(startBot, 800); // reconnect cepat
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

        // Ambil text paling cepat
        const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text;

        if (!text) return;

        // Fast filter (tanpa toLowerCase)
        if (
            text.indexOf('dana') === -1 &&
            text.indexOf('gopay') === -1 &&
            text.indexOf('shopee') === -1
        ) return;

        const links = extractLinks(text);
        if (!links.length) return;

        for (let i = 0; i < links.length; i++) {
            const link = links[i];

            if (activeLinks.has(link)) continue;

            activeLinks.add(link);

            // Batasi ukuran cache biar ringan
            if (activeLinks.size > 500) {
                activeLinks.clear();
            }

            // 🚀 EKSEKUSI PALING CEPAT DI TERMUX
            exec(`termux-open-url "${link}"`, { stdio: 'ignore' });
        }
    });
}

// ===== RUN =====
startBot();