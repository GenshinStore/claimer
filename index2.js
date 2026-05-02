const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { spawn } = require('child_process');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron'); // Tambahkan library node-cron

const GRUP_UTAMA = '120363408426078537@g.us';
const GRUP_KEDUA = '120363426296094605@g.us'; 
const TARGET_GROUP_IDS = [GRUP_UTAMA, GRUP_KEDUA];
const linkRegex = /(https?:\/\/)?([\w-]+\.)?(dana\.id|link\.dana\.id|gopay\.co\.id|app\.gopay\.co\.id|shopeepay\.co\.id|shopee\.co\.id\/universal-link)(\/[^\s]*)?/gi;

// Set memory link berada di luar agar tidak kerestart saat bot ON/OFF
const claimedLinks = new Set();

let sock; // Deklarasi sock di luar agar bisa diakses oleh cron
let isScheduledSleep = false; // Penanda apakah bot sengaja ditidurkan

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();
    
    // Inisialisasi socket ke variabel global
    sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['TermuxClaimer', 'Chrome', '1.0.0'],
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 10000
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) qrcode.generate(qr, { small: true });

        if (connection === 'close') {
            const reason = lastDisconnect.error?.output?.statusCode;
            const shouldReconnect = reason !== 401; 

            // Cek apakah putus karena jadwal tidur
            if (isScheduledSleep) {
                console.log('💤 Bot sedang tidur sesuai jadwal. Auto-reconnect dimatikan sementara.');
            } 
            // Jika putus karena error jaringan/server, lakukan auto-reconnect
            else if (shouldReconnect) {
                console.log('🔄 Koneksi putus tak terduga! Mencoba menyambung kembali...');
                setTimeout(startBot, 3000);
            } else {
                console.log('⚠️ Sesi tidak valid. Silakan hapus folder auth_info_baileys.');
            }
        } else if (connection === 'open') {
            console.log('⚡ BOT SIAP! (Mode Multi-Grup & Terjadwal)');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        if (!TARGET_GROUP_IDS.includes(from)) return;

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (!text) return;

        const bodyLower = text.toLowerCase();
        if (!bodyLower.includes('dana') && !bodyLower.includes('gopay') && !bodyLower.includes('shopee')) return;

        const matches = text.match(linkRegex);
        if (!matches) return;

        const eksekusiLink = (link, sumberGrup) => {
            if (claimedLinks.has(link)) return;

            claimedLinks.add(link);
            const child = spawn('termux-open-url', [link], { detached: true, stdio: 'ignore' });
            child.unref(); 
            console.log(`🚀 EKSEKUSI [${sumberGrup === GRUP_UTAMA ? 'UTAMA' : 'KEDUA'}]: ${link}`);

            if (claimedLinks.size > 500) {
                const oldestLink = claimedLinks.values().next().value;
                claimedLinks.delete(oldestLink);
            }
        };

        for (let i = 0; i < matches.length; i++) {
            let link = matches[i].startsWith('http') ? matches[i] : 'https://' + matches[i];

            if (from === GRUP_UTAMA) {
                eksekusiLink(link, from);
            } else if (from === GRUP_KEDUA) {
                setTimeout(() => eksekusiLink(link, from), 1000);
            }
        }
    });
}

// ==========================================
// PENGATURAN JADWAL (CRON JOB)
// ==========================================

// Jadwal OFF: Setiap hari jam 04:50
cron.schedule('50 4 * * *', () => {
    console.log(`[JADWAL] Waktunya OFF (disconnect tanpa logout). Session aman.`);
    isScheduledSleep = true; // Aktifkan penanda tidur
    if (sock) {
        sock.end(undefined); // Memutus koneksi Baileys dengan aman
    }
});

// Jadwal ON: Setiap hari jam 05:00
cron.schedule('0 5 * * *', () => {
    console.log(`[JADWAL] Waktunya ON kembali (tanpa login ulang).`);
    isScheduledSleep = false; // Matikan penanda tidur
    startBot(); // Jalankan ulang bot dengan session lama
});

// Jalankan bot untuk pertama kali
startBot();