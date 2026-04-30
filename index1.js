process.setMaxListeners(0);

const { Client, LocalAuth } = require('whatsapp-web.js');
const { exec } = require('child_process');

const TARGET_GROUP_ID = '120363426296094605@g.us';

const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'claimer_bot' }),
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
            '--single-process'
        ]
    }
});

client.on('qr', qr => {
    console.log(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`);
});

client.on('ready', () => {
    console.log('BOT SUPER CEPAT SIAP!');
});

const linkRegex = /(https?:\/\/)?([\w-]+\.)?(dana\.id|link\.dana\.id|gopay\.co\.id|app\.gopay\.co\.id|shopeepay\.co\.id|shopee\.co\.id\/universal-link)(\/[^\s]*)?/gi;
// const linkRegex = /(https?:\/\/)?(link\.dana\.id|dana\.id|shopee\.co\.id\/universal-link|app\.gopay\.co\.id)\/[^\s]*/gi;

const openedLinks = new Set();

client.on('message', msg => {
    if (msg.from !== TARGET_GROUP_ID) return;
    if (msg.type !== 'chat') return;
    if (!msg.body) return;

    const matches = msg.body.match(linkRegex);
    if (!matches) return;

    for (let rawLink of matches) {
        let link = rawLink.startsWith('http') ? rawLink : 'https://' + rawLink;

        if (openedLinks.has(link)) continue;
        openedLinks.add(link);

        exec(`termux-open-url "${link}"`, { windowsHide: true });
    }
});

client.initialize();