process.setMaxListeners(0);

const { Client, LocalAuth } = require('whatsapp-web.js');
const { exec } = require('child_process');

const TARGET_GROUP_ID = '120363426296094605@g.us';

// Inisialisasi client dengan pengaturan Puppeteer yang sangat ringan untuk Termux
const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'claimer_bot' }), // Menyimpan sesi login agar tidak perlu scan QR terus
    puppeteer: {
        executablePath: '/data/data/com.termux/files/usr/bin/chromium-browser',
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-extensions',
            '--disable-background-networking',
            '--disable-sync',
            '--disable-translate',
            '--metrics-recording-only',
            '--mute-audio',
            '--single-process' // Penting untuk performa di Termux Android
        ]
    }
});

// Menampilkan QR Code di terminal (hanya jika sesi belum ada)
client.on('qr', qr => {
    console.log(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`);
});

// Indikator bahwa bot sudah terhubung dan berjalan
client.on('ready', () => {
    console.log('BOT SUPER CEPAT SIAP!');
});

// Regex untuk mendeteksi format link e-wallet
const linkRegex = /(https?:\/\/)?([\w-]+\.)?(dana\.id|link\.dana\.id|gopay\.co\.id|app\.gopay\.co\.id|shopeepay\.co\.id|shopee\.co\.id\/universal-link)(\/[^\s]*)?/gi;

client.on('message', msg => {
    // 1. FILTER AWAL: Pastikan pesan dari grup target dan berupa teks (Bukan media/dokumen)
    if (msg.from !== TARGET_GROUP_ID || msg.type !== 'chat' || !msg.body) return;

    // 2. OPTIMASI KECEPATAN (QUICK CHECK): 
    // Menggunakan `.includes()` jauh lebih ringan dan cepat daripada langsung menjalankan Regex.
    const bodyLower = msg.body.toLowerCase();
    if (!bodyLower.includes('dana') && !bodyLower.includes('gopay') && !bodyLower.includes('shopee')) return;

    // 3. EKSTRAKSI LINK: Jika lolos filter cepat di atas, baru jalankan Regex
    const matches = msg.body.match(linkRegex);
    if (!matches) return;

    // 4. EKSEKUSI SUPER CEPAT (FIRE AND FORGET)
    for (let i = 0; i < matches.length; i++) {
        // Pastikan format link memiliki awalan http/https agar termux-open-url tidak error
        let link = matches[i].startsWith('http') ? matches[i] : 'https://' + matches[i];

        // Eksekusi langsung tanpa mengecek duplikat sama sekali
        exec(`termux-open-url "${link}"`, { windowsHide: true });
    }
});

// Memulai client WhatsApp
client.initialize();