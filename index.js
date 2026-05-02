const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { spawn } = require('child_process');

const TARGET_GROUP_ID = '120363426296094605@g.us'; // Pastikan format JID grup benar (akhiran @g.us)

// Regex untuk e-wallet
const linkRegex = /(https?:\/\/)?([\w-]+\.)?(dana\.id|link\.dana\.id|gopay\.co\.id|app\.gopay\.co\.id|shopeepay\.co\.id|shopee\.co\.id\/universal-link)(\/[^\s]*)?/gi;

async function startBot() {
    // Menyimpan sesi login di folder 'auth_info_baileys' agar tidak perlu scan QR terus
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        // WAJIB: Mematikan log agar Termux tidak lag saat menerima banyak pesan
        logger: pino({ level: 'silent' }), 
        // Mengelabui WA agar terlihat seperti session biasa
        browser: ['TermuxClaimer', 'Chrome', '1.0.0']
    });

    // Simpan kredensial setiap kali ada pembaruan sesi
    sock.ev.on('creds.update', saveCreds);

    // Indikator koneksi
    sock.ev.on('connection.update', (update) => {
        const { connection } = update;
        if (connection === 'open') {
            console.log(' BOT SUPER CEPAT (BAILEYS) SIAP!');
        }
    });

    // Event saat menerima pesan baru
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        // Hanya proses pesan baru
        if (type !== 'notify') return;
        const msg = messages[0];

        // Pastikan ada isinya
        if (!msg.message) return;

        // 1. FILTER GRUP TARGET
        const from = msg.key.remoteJid;
        if (from !== TARGET_GROUP_ID) return;

        // Ekstrak teks pesan (Struktur JSON Baileys sedikit berbeda dari whatsapp-web.js)
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (!text) return;

        // 2. OPTIMASI KECEPATAN (QUICK CHECK)
        const bodyLower = text.toLowerCase();
        if (!bodyLower.includes('dana') && !bodyLower.includes('gopay') && !bodyLower.includes('shopee')) return;

        // 3. EKSTRAKSI LINK
        const matches = text.match(linkRegex);
        if (!matches) return;

        // 4. EKSEKUSI SUPER CEPAT DENGAN SPAWN (FIRE AND FORGET)
        for (let i = 0; i < matches.length; i++) {
            let link = matches[i].startsWith('http') ? matches[i] : 'https://' + matches[i];

            // Menggunakan spawn dengan { detached: true } agar langsung dilepas ke OS tanpa delay
            const child = spawn('termux-open-url', [link], {
                detached: true,
                stdio: 'ignore' // Abaikan output terminal untuk menghemat RAM
            });
            child.unref(); // Biarkan proses pembukaan link berjalan independen
            
            console.log(` Link terdeteksi dan dieksekusi: ${link}`);
        }
    });
}

// Menjalankan bot
startBot();