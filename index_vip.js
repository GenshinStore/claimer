const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { spawn } = require('child_process');
const qrcode = require('qrcode-terminal');

// ================= CONFIGURATION =================
const MODE_ALL_GROUPS = false; // Ubah ke true untuk scan semua grup, false untuk fokus 1 grup prioritas
const PRIORITY_GROUP_ID = '120363426296094605@g.us'; // Target utama jika mode false

const TARGET_GROUP_IDS = new Set([
    '120363408426078537@g.us', 
    '120363426296094605@g.us'
]);

// Optimasi Regex: Gunakan Non-Capturing Group (?:) agar engine regex tidak menyimpan memori pencocokan
const linkRegex = /(?:https?:\/\/)?(?:dana\.id|link\.dana\.id|gopay\.co\.id|shopee\.co\.id)[^\s]+/gi;

// Fast Regex untuk menggantikan toLowerCase().includes() yang boros RAM
const fastFilterRegex = /dana|gopay|shopee/i; 

const activeLinks = new Set();
const CACHE_TTL = 1000;

// Fitur Auto-Schedule untuk menjaga stabilitas memori & sesi WhatsApp
let isBotActive = true;
setInterval(() => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    if (hours === 4 && minutes >= 50) isBotActive = false;
    else if (hours === 5 && minutes >= 0) isBotActive = true;
}, 60000);

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }), // Ganti ke silent untuk memangkas I/O stream console yang bikin delay
        connectTimeoutMs: 20000,
        keepAliveIntervalMs: 5000,
        getMessage: async () => null,
        syncFullHistory: false, // Mempercepat startup awal
        markOnlineOnConnect: false, // Bypass delay update status online
        generateHighQualityLinkPreviews: false // OPTIMASI: Mencegah Baileys memproses link di background
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
        if (qr) qrcode.generate(qr, { small: true });
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== 401) setTimeout(startBot, 1000); // Reconnect lebih brutal (500ms)
        }
        if (connection === 'open') {
            console.log(`⚡ BOT SIAP: MODE EXTREME SPEED | TARGET: ${MODE_ALL_GROUPS ? 'SEMUA GRUP' : '1 GRUP PRIORITAS'}`);
        }
    });

    sock.ev.on('messages.upsert', ({ messages, type }) => {
        if (type !== 'notify' || !isBotActive) return;

        // Akses index langsung untuk menghindari destructuring object besar
        const msg = messages[0];
        const from = msg?.key?.remoteJid;

        if (!from) return;

        // Pengecekan Mode Grup (O(1) sangat cepat)
        if (MODE_ALL_GROUPS) {
            if (!TARGET_GROUP_IDS.has(from)) return; // Cek semua grup
        } else {
            if (from !== PRIORITY_GROUP_ID) return; // Langsung potong jika bukan grup utama
        }

        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
        
        // Short-circuit: Link terpendek butuh minimal ~15 karakter, buang langsung jika kurang
        if (!text || text.length < 15) return; 

        // C++ native regex test jauh lebih cepat daripada alokasi memori text.toLowerCase()
        if (!fastFilterRegex.test(text)) return;

        // FIX BUG PENTING: Harus reset lastIndex jika menggunakan regex global (/g) di dalam loop
        linkRegex.lastIndex = 0; 
        
        let match;
        // Gunakan RegExp.exec dalam loop. Di V8 Node.js, exec lebih cepat daripada .match()
        while ((match = linkRegex.exec(text)) !== null) {
            let link = match[0];

            if (!link.startsWith('http')) link = 'https://' + link;

            // Filter Presisi DANA (Hanya Kaget, Anti-Minta, Anti-Kosong)
            if (link.includes('dana.id')) {
                const lowerLink = link.toLowerCase();
                if (!lowerLink.includes('kaget') || lowerLink.includes('/minta') || link.length <= 20) {
                    continue; 
                }
            }

            if (activeLinks.has(link)) continue;

            activeLinks.add(link);
            setTimeout(() => activeLinks.delete(link), CACHE_TTL);

            // BYPASS SCRIPT WRAPPER - Tembak Intent Android Langsung via am start Termux
            spawn('am', ['start', '-a', 'android.intent.action.VIEW', '-d', link], {
                detached: true,
                stdio: 'ignore'
            }).unref();

            console.log('🚀 GAS:', link);
        }
    });
}

startBot();