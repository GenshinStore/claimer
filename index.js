const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { spawn } = require('child_process');
const qrcode = require('qrcode-terminal');

// Definisikan Grup
const GRUP_UTAMA = '120363408426078537@g.us';
const GRUP_KEDUA = '120363426296094605@g.us';

// Set untuk O(1) lookup
const TARGET_GROUP_IDS = new Set([GRUP_UTAMA, GRUP_KEDUA]);

const linkRegex = /(https?:\/\/)?([\w-]+\.)?(dana\.id|link\.dana\.id|gopay\.co\.id|app\.gopay\.co\.id|shopeepay\.co\.id|shopee\.co\.id\/universal-link)(\/[^\s]*)?/gi;

// Memori jangka pendek untuk mencegah duplikasi instan
const activeLinks = new Set();
const CACHE_TTL = 10000; // Cache link kedaluwarsa dalam 10 detik

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();
    
    console.log(`Meminta QR menggunakan WA v${version.join('.')}`);

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['TermuxClaimer', 'Chrome', '1.0.0'],
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 10000,
        getMessage: async () => ({ conversation: '' }) // Optimasi memori untuk Baileys
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            qrcode.generate(qr, { small: true });
            console.log('👆 Silakan scan QR Code di atas!');
        }

        if (connection === 'close') {
            const reason = lastDisconnect.error?.output?.statusCode;
            if (reason !== 401) {
                console.log('🔄 Mencoba menyambung kembali dalam 3 detik...');
                setTimeout(startBot, 3000);
            } else {
                console.log('⚠️ Sesi tidak valid. Silakan hapus folder auth_info_baileys dan scan ulang.');
            }
        } else if (connection === 'open') {
            console.log('⚡ BOT SIAP! (Mode Eksekusi Real-time Aktif)');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        
        const msg = messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        
        // Pengecekan cepat menggunakan Set.has (Lebih cepat dari Array.includes)
        if (!TARGET_GROUP_IDS.has(from)) return;

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (!text) return;

        // Pengecekan kata kunci sebelum memproses Regex (Fast-fail check)
        const bodyLower = text.toLowerCase();
        if (!bodyLower.includes('dana') && !bodyLower.includes('gopay') && !bodyLower.includes('shopee')) return;

        const matches = text.match(linkRegex);
        if (!matches) return;

        // Eksekusi semua link yang ditemukan secepat mungkin
        for (let i = 0; i < matches.length; i++) {
            let link = matches[i].startsWith('http') ? matches[i] : 'https://' + matches[i];

            // Cek duplikasi real-time
            if (!activeLinks.has(link)) {
                // Langsung daftarkan ke cache untuk memblokir duplikat dari grup lain dalam milidetik yang sama
                activeLinks.add(link);
                
                // Hapus dari cache setelah 10 detik agar tidak membebani memori
                setTimeout(() => activeLinks.delete(link), CACHE_TTL);

                // Eksekusi link via Termux secara asynchronous tanpa menunggu
                spawn('termux-open-url', [link], { detached: true, stdio: 'ignore' }).unref();
                
                console.log(`🚀 EKSEKUSI [${from === GRUP_UTAMA ? 'Grup 1' : 'Grup 2'}]: ${link}`);
            } else {
                console.log(`⏭️ SKIP DUPLIKAT: ${link}`);
            }
        }
    });
}

startBot();