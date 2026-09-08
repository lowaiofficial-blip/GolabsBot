const { Client, GatewayIntentBits, REST, Routes, ApplicationCommandOptionType } = require('discord.js');
const express = require('express');
const OpenAI = require('openai');

// 1. ADIM: Kesintisiz Çalışma Sunucusu (Render/Replit)
const app = express();
app.get('/', (req, res) => res.send('GoLabs Bot Aktif!'));
app.listen(process.env.PORT || 3000, () => console.log('Web sunucusu hazır.'));

// 2. ADIM: Güvenli Çevre Değişkenleri
const TOKEN = process.env.DISCORD_TOKEN; 
const CLIENT_ID = process.env.CLIENT_ID; 
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY; 
const FOUNDER_ROLE_ID = "1545688948565606510"; // Founder rol ID'n

// OpenRouter Yapılandırması (Arka planda Llama 4 Scout kullanır)
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "https://discord.com",
    "X-Title": "GoLabs Bot"
  }
});

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

// Slash Komutlarını Discord'a Kaydetme
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

// Slash Komut Dinleyicisi
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    // MEVCUT /tlk KOMUTU (DEĞİŞTİRİLMEDİ)
    if (interaction.commandName === 'tlk') {
        if (!interaction.member.roles.cache.has(FOUNDER_ROLE_ID)) {
            return interaction.reply({ 
                content: '❌ Bu komutu sadece Founder kullanabilir.', 
                ephemeral: true 
            });
        }

        const gonderilecekMesaj = interaction.options.getString('mesaj');

        await interaction.deferReply({ ephemeral: true });
        await interaction.channel.send(gonderilecekMesaj);
        await interaction.deleteReply();
    }

    // YENİ: /ai SLASH KOMUTU (Flash 1.0)
    if (interaction.commandName === 'ai') {
        const soru = interaction.options.getString('soru');
        await interaction.deferReply();

        try {
            const completion = await openai.chat.completions.create({
                model: "meta-llama/llama-4-scout",
                messages: [{ role: "user", content: soru }]
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

// YENİ: BOTA ETİKET ATARAK KONUŞMA (@GoLabs Bot <soru>)
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.mentions.has(client.user)) return;

    // Etiket kısmını temizleyip soruyu alıyoruz
    const soru = message.content.replace(`<@${client.user.id}>`, '').replace(`<@!${client.user.id}>`, '').trim();
    if (!soru) return message.reply("Merhaba! Flash 1.0 modeliyle sana nasıl yardımcı olabilirim?");

    try {
        await message.channel.sendTyping(); // Bot yazıyor... efektini başlatır

        const completion = await openai.chat.completions.create({
            model: "meta-llama/llama-4-scout",
            messages: [{ role: "user", content: soru }]
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
