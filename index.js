const { Client, LocalAuth } = require('whatsapp-web.js');
const { exec } = require('child_process');

// Sesuaikan dengan ID Grup Target tempat index.js mem-forward link
const TARGET_GROUP_ID = '120363426296094605@g.us';

const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'claimer_bot' }),
    puppeteer: {
        executablePath: '/data/data/com.termux/files/usr/bin/chromium-browser',
        headless: true,
        // Konfigurasi ini biasanya aman untuk Termux
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('Scan QR ini untuk meloginkan Bot Claimer di HP Anda:');
    console.log(`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qr)}`);
});

client.on('ready', () => {
    console.log('✅ Bot Claimer stand-by! Memantau grup target...');
});

client.on('message', async (msg) => {
    // Hanya proses pesan dari grup target
    if (msg.from === TARGET_GROUP_ID) {
        const text = msg.body || '';

        // Cari link DANA
        const danaLinkMatch = text.match(/(https?:\/\/)?(link\.dana\.id|dana\.id)\/[^\s]*/i);

        if (danaLinkMatch) {
            const danaLink = danaLinkMatch[0];
            console.log(`⚡ Link DANA Terdeteksi! Membuka: ${danaLink}`);

            // Eksekusi Android Intent untuk langsung membuka link di HP
            // Command 'am start' akan memaksa OS Android membuka URL menggunakan aplikasi default (DANA)
            exec(`am start -a android.intent.action.VIEW -d "${danaLink}"`, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Gagal membuka link di HP: ${error.message}`);
                    return;
                }
                console.log('🚀 Link berhasil dilempar ke aplikasi DANA!');
            });
        }
    }
});

client.initialize();