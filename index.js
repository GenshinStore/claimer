const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { spawn } = require('child_process');
const qrcode = require('qrcode-terminal'); // Tambahkan library ini

const TARGET_GROUP_ID = '120363426296094605@g.us';

const linkRegex = /(https?:\/\/)?([\w-]+\.)?(dana\.id|link\.dana\.id|gopay\.co\.id|app\.gopay\.co\.id|shopeepay\.co\.id|shopee\.co\.id\/universal-link)(\/[^\s]*)?/gi;

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        // printQRInTerminal: true, <--- INI SUDAH DIHAPUS
        logger: pino({ level: 'silent' }), 
        browser: ['TermuxClaimer', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    // LOGIKA BARU UNTUK KONEKSI & MENAMPILKAN QR MANUAL
    // LOGIKA BARU UNTUK KONEKSI & MENAMPILKAN QR MANUAL
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        // Jika ada QR baru, tampilkan di terminal
        if (qr) {
            qrcode.generate(qr, { small: true });
            console.log('👆 Silakan scan QR Code di atas!');
        }

        // Jika koneksi terputus
        if (connection === 'close') {
            const reason = lastDisconnect.error?.output?.statusCode;
            const shouldReconnect = reason !== 401; // 401 = Logged out

            console.log(`❌ Koneksi terputus! (Kode Error: ${reason})`);
            console.log('Pesan Error Asli:', lastDisconnect.error?.message);

            if (shouldReconnect) {
                console.log('🔄 Mencoba menyambung kembali dalam 3 detik...');
                setTimeout(() => {
                    startBot();
                }, 3000); // Diberi jeda 3 detik agar terminal tidak nge-spam
            } else {
                console.log('⚠️ Sesi tidak valid atau ter-logout. Silakan hapus folder auth_info_baileys dan scan ulang.');
            }
        } else if (connection === 'open') {
            console.log('⚡ BOT SUPER CEPAT (BAILEYS) SIAP!');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        if (from !== TARGET_GROUP_ID) return;

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (!text) return;

        const bodyLower = text.toLowerCase();
        if (!bodyLower.includes('dana') && !bodyLower.includes('gopay') && !bodyLower.includes('shopee')) return;

        const matches = text.match(linkRegex);
        if (!matches) return;

        for (let i = 0; i < matches.length; i++) {
            let link = matches[i].startsWith('http') ? matches[i] : 'https://' + matches[i];

            const child = spawn('termux-open-url', [link], {
                detached: true,
                stdio: 'ignore'
            });
            child.unref(); 
            
            console.log(`🚀 Link dieksekusi: ${link}`);
        }
    });
}

startBot();