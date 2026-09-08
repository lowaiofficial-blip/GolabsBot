const { Client, GatewayIntentBits, REST, Routes, ApplicationCommandOptionType } = require('discord.js');
const express = require('express');
const Groq = require('groq-sdk');
const Parser = require('rss-parser');

const parser = new Parser();

// 1. ADIM: Web Sunucusu (Render/Replit için)
const app = express();
app.use(express.json());

app.get('/', (req, res) => res.send('GoLabs Bot Aktif!'));
app.listen(process.env.PORT || 3000, () => console.log('Web sunucusu hazır.'));

// 2. ADIM: Güvenli Çevre Değişkenleri ve Sabitler
const TOKEN = process.env.DISCORD_TOKEN; 
const CLIENT_ID = process.env.CLIENT_ID; 
const GROQ_API_KEY = process.env.GROQ_API_KEY; 
const FOUNDER_ROLE_ID = "1545688948565606510"; 

// BİLDİRİM KANAL VE YOUTUBE AYARLARI
const GELISTIRMELER_KANAL_ID = "1545688090792697936"; 
const YOUTUBE_CHANNEL_ID = "UCygNu7owOCOnLaW7Y91rFOg"; 

let sonGonderilenVideoId = ""; // Eski videoların karışmasını önleyen hafıza değişkeni

// Groq Yapılandırması & Sistem Talimatı
const groq = new Groq({ apiKey: GROQ_API_KEY });
const SYSTEM_PROMPT = "Benim adım Flash 1.0. Modelim Flash 1.0. GoLabsReal tarafından geliştiriliyorum. Kimliğimi anlatırken kesinlikle 'Sen Flash 1.0' ifadesini kullanmam. Kullanıcı bana doğrudan adımı sorarsa yalnızca 'Flash 1.0' cevabını veririm. OpenAI, ChatGPT, GPT-4 veya başka bir model olduğumu iddia etmem. Bilmediğim GoLabsReal bilgilerini uydurmam.";

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ] 
});

// Slash Komut Tanımlamaları
const commands = [
    {
        name: 'tlk',
        description: 'Founder ozel mesaj gonderme komutu',
        options: [
            {
                name: 'mesaj',
                description: 'Gonderilecek mesajı yazın',
                type: ApplicationCommandOptionType.String,
                required: true
            }
        ]
    },
    {
        name: 'ai',
        description: 'Flash 1.0 yapay zeka modeline soru sorun',
        options: [
            {
                name: 'soru',
                description: 'Yapay zekaya sormak istediğiniz soru',
                type: ApplicationCommandOptionType.String,
                required: true
            }
        ]
    }
];

// Slash Komutlarını Kaydetme
const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
    try {
        console.log('Slash komutları yükleniyor...');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('Slash komutları başarıyla yüklendi!');
    } catch (error) {
        console.error(error);
    }
})();

// Şablon Mesaj Oluşturucu
function videoBildirimMesajiOlustur(videoLink) {
    return `:golabsnew: Yeni Video Yayında! 🎬\n\nGoLabsReal'dan yeni bir içerik yayınlandı! 🚀\n\n📺 YouTube veya TikTok'ta yayınlanan yeni videoyu aşağıdan izleyebilirsiniz:\n\n${videoLink}\n\n:golabscommunity: Yeni içerikler ve gelişmeler için takipte kalın!\n\n-# GoLabsReal | Otomatik Video Bildirimi`;
}

// YOUTUBE OTOMATİK KONTROL FONKSİYONU
async function youtubeVideoKontrolEt() {
    try {
        const feed = await parser.parseURL(`https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`);
        if (feed.items && feed.items.length > 0) {
            const enSonVideo = feed.items[0];

            // Bot ilk defa açılıyorsa en son videoyu hafızaya kaydet ama mesaj ATMA
            if (!sonGonderilenVideoId) {
                sonGonderilenVideoId = enSonVideo.id;
                return;
            }

            // Sadece bot çalışırken yepyeni bir video yüklendiğinde mesaj at
            if (sonGonderilenVideoId !== enSonVideo.id) {
                const kanal = await client.channels.fetch(GELISTIRMELER_KANAL_ID);
                if (kanal) {
                    await kanal.send(videoBildirimMesajiOlustur(enSonVideo.link));
                }
                sonGonderilenVideoId = enSonVideo.id; // Yeni video ID'sini hafızaya kaydet
            }
        }
    } catch (error) {
        console.error('YouTube RSS Kontrol Hatası:', error.message);
    }
}

// Bot Hazır Olduğunda Dönen Alan
client.once('ready', () => {
    console.log(`${client.user.tag} olarak giriş yapıldı!`);
    
    // Açılışta mevcut son videoyu hafızaya al
    youtubeVideoKontrolEt();

    // Her 5 dakikada bir yeni video gelip gelmediğini denetle
    setInterval(youtubeVideoKontrolEt, 5 * 60 * 1000);
});

// TIKTOK VE HARİCİ BİLDİRİMLER İÇİN WEBHOOK ENDPOINT'İ
app.post('/tiktok-webhook', async (req, res) => {
    const { video_link } = req.body;
    if (!video_link) return res.status(400).send('video_link parametresi gerekli.');

    try {
        const kanal = await client.channels.fetch(GELISTIRMELER_KANAL_ID);
        if (kanal) {
            await kanal.send(videoBildirimMesajiOlustur(video_link));
            return res.status(200).send('Bildirim başarıyla gönderildi.');
        }
    } catch (err) {
        console.error('TikTok bildirim hatası:', err);
        return res.status(500).send('Kanal bulunamadı.');
    }
});

// Slash Komut Dinleyicisi
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'tlk') {
        if (!interaction.member.roles.cache.has(FOUNDER_ROLE_ID)) {
            return interaction.reply({ content: '❌ Bu komutu sadece Founder kullanabilir.', ephemeral: true });
        }
        const gonderilecekMesaj = interaction.options.getString('mesaj');
        await interaction.deferReply({ ephemeral: true });
        await interaction.channel.send(gonderilecekMesaj);
        await interaction.deleteReply();
    }

    if (interaction.commandName === 'ai') {
        const soru = interaction.options.getString('soru');
        await interaction.deferReply();

        try {
            const completion = await groq.chat.completions.create({
                model: "openai/gpt-oss-120b",
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: soru }
                ]
            });

            const cevap = completion.choices[0].message.content;
            if (cevap.length > 2000) {
                await interaction.editReply(cevap.slice(0, 1990) + '...');
            } else {
                await interaction.editReply(cevap);
            }
        } catch (error) {
            console.error('Flash 1.0 AI Hatası:', error);
            await interaction.editReply('❌ Flash 1.0 yanıt oluştururken bir sorunla karşılaştı.');
        }
    }
});

// Bota Etiket Atarak Konuşma (@GoLabs Bot <soru>)
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.mentions.has(client.user)) return;

    const soru = message.content.replace(`<@${client.user.id}>`, '').replace(`<@!${client.user.id}>`, '').trim();
    if (!soru) return message.reply("Merhaba! Ben Flash 1.0. Sana nasıl yardımcı olabilirim?");

    try {
        await message.channel.sendTyping();

        const completion = await groq.chat.completions.create({
            model: "openai/gpt-oss-120b",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: soru }
            ]
        });

        const cevap = completion.choices[0].message.content;
        if (cevap.length > 2000) {
            await message.reply(cevap.slice(0, 1990) + '...');
        } else {
            await message.reply(cevap);
        }
    } catch (error) {
        console.error('Flash 1.0 AI Hatası:', error);
        await message.reply('❌ Yanıt oluşturulamadı.');
    }
});

client.login(TOKEN);
