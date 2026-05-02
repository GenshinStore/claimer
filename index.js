// Tambahkan 'Browsers' di baris pertama ini
const { default: makeWASocket, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { spawn } = require('child_process');
const qrcode = require('qrcode-terminal');

const TARGET_GROUP_ID = '120363426296094605@g.us';
const linkRegex = /(https?:\/\/)?([\w-]+\.)?(dana\.id|link\.dana\.id|gopay\.co\.id|app\.gopay\.co\.id|shopeepay\.co\.id|shopee\.co\.id\/universal-link)(\/[^\s]*)?/gi;

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        // 1. UBAH SEMENTARA: Ganti 'silent' jadi 'info' agar kita bisa lihat prosesnya
        logger: pino({ level: 'info' }), 
        // 2. UBAH: Gunakan identitas browser yang lebih aman (Linux Chrome)
        browser: Browsers.ubuntu('Chrome'), 
        // Tambahan opsi untuk memaksa koneksi lebih stabil
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 10000
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
            const shouldReconnect = reason !== 401; 

            console.log(`❌ Koneksi terputus! (Kode Error: ${reason})`);

            if (shouldReconnect) {
                console.log('🔄 Mencoba menyambung kembali dalam 3 detik...');
                setTimeout(() => {
                    startBot();
                }, 3000);
            } else {
                console.log('⚠️ Sesi tidak valid. Silakan hapus folder auth_info_baileys dan scan ulang.');
            }
        } else if (connection === 'open') {
            console.log('⚡ BOT SUPER CEPAT (BAILEYS) SIAP!');
            // Jika sudah berhasil konek, kita bisa set log kembali ke silent nanti
        }
    });

    // ... (Bagian sock.ev.on('messages.upsert', ...) tetap sama seperti sebelumnya) ...
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
            const child = spawn('termux-open-url', [link], { detached: true, stdio: 'ignore' });
            child.unref(); 
            console.log(`🚀 Link dieksekusi: ${link}`);
        }
    });
}

startBot();