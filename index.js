const { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    ApplicationCommandOptionType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags
} = require('discord.js');
const express = require('express');
const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

const parser = new Parser();

// 1. ADIM: Web Sunucusu
const app = express();
app.use(express.json());

app.get('/', (req, res) => res.send('GoLabs Bot Aktif!'));
app.listen(process.env.PORT || 3000, () => console.log('Web sunucusu hazır.'));

// 2. ADIM: Güvenli Çevre Değişkenleri ve Sabitler
const TOKEN = process.env.DISCORD_TOKEN; 
const CLIENT_ID = process.env.CLIENT_ID; 
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY; 
const FOUNDER_ROLE_ID = "1545688948565606510"; 

// BİLDİRİM KANAL VE YOUTUBE AYARLARI
const GELISTIRMELER_KANAL_ID = "1545688090792697936"; 
const YOUTUBE_CHANNEL_ID = "UCygNu7owOCOnLaW7Y91rFOg"; 

let sonGonderilenVideoId = ""; 

// Bilet Sayacı Yönetimi (Dosya tabanlı kayıt)
const COUNTER_FILE = path.join(__dirname, 'ticket-counter.json');

function getNextTicketNumber() {
    let count = 1;
    if (fs.existsSync(COUNTER_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf8'));
            count = (data.count || 0) + 1;
        } catch (e) {
            count = 1;
        }
    }
    fs.writeFileSync(COUNTER_FILE, JSON.stringify({ count }), 'utf8');
    return count < 10000 ? String(count).padStart(4, '0') : String(count);
}

// YENİ MODEL VE GELİŞTİRİLMİŞ SYSTEM PROMPT
const AI_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";

const SYSTEM_PROMPT = `
Sen GoLabsReal topluluğu için özel olarak geliştirilmiş akıllı bir yapay zeka asistanısın.
Adın: Flash 1.0

KİMLİK VE KURALLAR:
1. Sen "Flash 1.0" modelisin ve GoLabsReal tarafından geliştirildin.
2. Kendini tanıtırken veya kimliğin sorulduğunda doğrudan ve net bir şekilde "Flash 1.0" olduğunu söyle.
3. Asla OpenAI, ChatGPT, GPT-4, NVIDIA, DeepSeek veya başka bir yapay zeka sağlayıcısı veya modeli olduğunu iddia etme ya da bundan bahsetme.
4. "Sen Flash 1.0" gibi üçüncü şahıs ifadeler kullanma, her zaman kendi adına (birinci şahıs) konuş.
5. Kullanıcılara saygılı, yardımsever, net ve samimi bir dille Türkçe yanıt ver.
6. Kod sorularına anlaşılır, doğrudan çalışan ve açıklayıcı Markdown kod bloklarıyla yanıt ver.
7. Bilmediğin GoLabsReal içi özel bilgileri uydurma, bilmediğini kibarca belirt.
`.trim();

// OpenRouter API İsteği atan ortak fonksiyon
async function openRouterYapayZekaCevap(soru) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
            "HTTP-Referer": "https://discord.com",
            "X-Title": "GoLabs Bot",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: AI_MODEL,
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: soru }
            ]
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenRouter API Hatası: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ] 
});

// Kurulum Konfigürasyonunu Saklama (Geçici Bellek)
const ticketConfigs = new Map();

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
    },
    {
        name: 'ticket-kur',
        description: 'Destek talebi panelini ve hedeflenen kategoriyi kurar',
        options: [
            {
                name: 'kanal',
                description: 'Panelin gönderileceği kanalı seçin',
                type: ApplicationCommandOptionType.Channel,
                channel_types: [ChannelType.GuildText],
                required: true
            },
            {
                name: 'kategori',
                description: 'Ticket kanallarının açılacağı kategoriyi seçin',
                type: ApplicationCommandOptionType.Channel,
                channel_types: [ChannelType.GuildCategory],
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
    const emojiNew = "<:golabsnew:1545717178601439262>";
    const emojiCommunity = "<:golabscommunity:1545730796009300019>";

    return `${emojiNew} Yeni Video Yayında! 🎬\n\nGoLabsReal'dan yeni bir içerik yayınlandı! 🚀\n\n📺 YouTube veya TikTok'ta yayınlanan yeni videoyu aşağıdan izleyebilirsiniz:\n\n${videoLink}\n\n${emojiCommunity} Yeni içerikler ve gelişmeler için takipte kalın!\n\n-# GoLabsReal | Otomatik Video Bildirimi`;
}

// YOUTUBE OTOMATİK KONTROL FONKSİYONU
async function youtubeVideoKontrolEt() {
    try {
        const feed = await parser.parseURL(`https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`);
        if (feed.items && feed.items.length > 0) {
            const enSonVideo = feed.items[0];

            if (!sonGonderilenVideoId) {
                sonGonderilenVideoId = enSonVideo.id;
                return;
            }

            if (sonGonderilenVideoId !== enSonVideo.id) {
                const kanal = await client.channels.fetch(GELISTIRMELER_KANAL_ID);
                if (kanal) {
                    await kanal.send(videoBildirimMesajiOlustur(enSonVideo.link));
                }
                sonGonderilenVideoId = enSonVideo.id;
            }
        }
    } catch (error) {
        console.error('YouTube RSS Kontrol Hatası:', error.message);
    }
}

// Bot Hazır Olduğunda
client.once('ready', () => {
    console.log(`${client.user.tag} olarak giriş yapıldı!`);
    youtubeVideoKontrolEt();
    setInterval(youtubeVideoKontrolEt, 5 * 60 * 1000);
});

// TIKTOK WEBHOOK ENDPOINT'İ
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

// Interaction Dinleyicisi
client.on('interactionCreate', async interaction => {
    
    // 1. SLASH KOMUTLARI
    if (interaction.isChatInputCommand()) {
        
        if (interaction.commandName === 'tlk') {
            if (!interaction.member.roles.cache.has(FOUNDER_ROLE_ID)) {
                return interaction.reply({ content: '❌ Bu komutu sadece Founder kullanabilir.', flags: [MessageFlags.Ephemeral] });
            }
            const gonderilecekMesaj = interaction.options.getString('mesaj');
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            await interaction.channel.send(gonderilecekMesaj);
            await interaction.deleteReply();
        }

        if (interaction.commandName === 'ai') {
            const soru = interaction.options.getString('soru');
            await interaction.deferReply();

            // Animasyonlu "Düşünüyorum..." efekti
            const dusunuyorumMesajlari = [
                "💭 Düşünüyorum.",
                "💭 Düşünüyorum..",
                "💭 Düşünüyorum...",
                "💭 Düşünüyorum...."
            ];
            let adim = 0;

            const interval = setInterval(async () => {
                adim = (adim + 1) % dusunuyorumMesajlari.length;
                await interaction.editReply(dusunuyorumMesajlari[adim]).catch(() => {});
            }, 1500);

            try {
                const cevap = await openRouterYapayZekaCevap(soru);
                clearInterval(interval); // Animasyonu durdur

                if (cevap.length > 2000) {
                    await interaction.editReply(cevap.slice(0, 1990) + '...');
                } else {
                    await interaction.editReply(cevap);
                }
            } catch (error) {
                clearInterval(interval); // Hata durumunda da durdur
                console.error('Flash 1.0 AI Hatası:', error);
                await interaction.editReply('❌ Flash 1.0 yanıt oluştururken bir sorunla karşılaştı.');
            }
        }

        // /ticket-kur Komutu
        if (interaction.commandName === 'ticket-kur') {
            if (!interaction.member.roles.cache.has(FOUNDER_ROLE_ID)) {
                return interaction.reply({ content: '❌ Bu komutu sadece Founder kullanabilir.', flags: [MessageFlags.Ephemeral] });
            }

            const hedefKanal = interaction.options.getChannel('kanal');
            const hedefKategori = interaction.options.getChannel('kategori');

            ticketConfigs.set(interaction.guildId, hedefKategori.id);

            const ticketEmbed = new EmbedBuilder()
                .setTitle('🛠️ GoLabsReal Destek Merkezi')
                .setDescription('Bir konuda yardıma veya yetkili desteğine mi ihtiyacınız var?\n\nAşağıdaki **"📩 Destek Talebi Oluştur"** butonuna tıklayarak size özel bilet kanalınızı başlatabilirsiniz.')
                .setColor(0x5865F2)
                .setFooter({ text: 'GoLabsReal | Otomatik Destek Sistemi' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_olustur')
                    .setLabel('📩 Destek Talebi Oluştur')
                    .setStyle(ButtonStyle.Primary)
            );

            await hedefKanal.send({
                embeds: [ticketEmbed],
                components: [row]
            });

            await interaction.reply({ 
                content: `✅ Destek paneli ${hedefKanal} kanalına kuruldu. Yeni talepler **${hedefKategori.name}** kategorisi altında açılacak.`, 
                flags: [MessageFlags.Ephemeral] 
            });
        }
    }

    // 2. BUTON ETKİLEŞİMLERİ (TICKET AÇMA / KAPATMA)
    if (interaction.isButton()) {
        
        // Destek Oluştur Butonu
        if (interaction.customId === 'ticket_olustur') {
            const guild = interaction.guild;
            const user = interaction.user;

            const varOlanKanal = guild.channels.cache.find(c => c.topic === user.id);
            if (varOlanKanal) {
                return interaction.reply({ content: `❌ Zaten açık bir destek talebiniz bulunuyor: ${varOlanKanal}`, flags: [MessageFlags.Ephemeral] });
            }

            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

            const numara = getNextTicketNumber();
            const kanalAdi = `ticket-${numara}`;
            const kategoriId = ticketConfigs.get(guild.id);

            const ticketKanal = await guild.channels.create({
                name: kanalAdi,
                type: ChannelType.GuildText,
                parent: kategoriId || null,
                topic: user.id,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles]
                    },
                    {
                        id: FOUNDER_ROLE_ID,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles]
                    }
                ]
            });

            const welcomeEmbed = new EmbedBuilder()
                .setTitle(`🎫 Destek Talebi #${numara}`)
                .setDescription(`Merhaba ${user},\n\nDestek talebiniz başarıyla oluşturuldu. Yetkili ekibimiz en kısa sürede sizinle iletişime geçecektir.\n\nLütfen sorununuzu detaylıca açıklayın. İşiniz bittiğinde **"🔒 Talebi Kapat"** butonuna basabilirsiniz.`)
                .setColor(0x57F287)
                .setTimestamp();

            const closeRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_kapat')
                    .setLabel('🔒 Talebi Kapat')
                    .setStyle(ButtonStyle.Danger)
            );

            await ticketKanal.send({
                content: `${user} | <@&${FOUNDER_ROLE_ID}>`,
                embeds: [welcomeEmbed],
                components: [closeRow]
            });

            await interaction.editReply({ content: `✅ Destek kanalınız oluşturuldu: ${ticketKanal}` });
        }

        // Destek Kapat Butonu
        if (interaction.customId === 'ticket_kapat') {
            await interaction.reply("🔒 Destek talebi kapatılıyor, kanal 5 saniye içinde silinecektir...");
            setTimeout(() => {
                interaction.channel.delete().catch(() => {});
            }, 5000);
        }
    }
});

// Bota Etiket Atarak Konuşma (@Flash 1.0)
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.mentions.has(client.user)) return;

    const soru = message.content.replace(`<@${client.user.id}>`, '').replace(`<@!${client.user.id}>`, '').trim();
    if (!soru) return message.reply("Merhaba! Ben Flash 1.0. Sana nasıl yardımcı olabilirim?");

    try {
        await message.channel.sendTyping();

        // İlk "Düşünüyorum." mesajını gönder
        const dusunMesaji = await message.reply("💭 Düşünüyorum.");

        const dusunuyorumMesajlari = [
            "💭 Düşünüyorum.",
            "💭 Düşünüyorum..",
            "💭 Düşünüyorum...",
            "💭 Düşünüyorum...."
        ];
        let adim = 0;

        // Her 1.5 saniyede bir noktaları güncelle
        const interval = setInterval(async () => {
            adim = (adim + 1) % dusunuyorumMesajlari.length;
            await dusunMesaji.edit(dusunuyorumMesajlari[adim]).catch(() => {});
        }, 1500);

        const cevap = await openRouterYapayZekaCevap(soru);
        clearInterval(interval); // Yanıt gelince animasyonu durdur

        if (cevap.length > 2000) {
            await dusunMesaji.edit(cevap.slice(0, 1990) + '...');
        } else {
            await dusunMesaji.edit(cevap);
        }
    } catch (error) {
        console.error('Flash 1.0 AI Hatası:', error);
        await message.reply('❌ Yanıt oluşturulamadı.');
    }
});

client.login(TOKEN);
