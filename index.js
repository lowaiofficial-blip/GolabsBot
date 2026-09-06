const { Client, GatewayIntentBits, REST, Routes, ApplicationCommandOptionType, AutoModerationRuleTriggerType, AutoModerationActionType, AutoModerationEventType } = require('discord.js');
const express = require('express');

// 1. ADIM: Render/Replit Kesintisiz Çalışma Hilesi (Web Sunucusu)
const app = express();
app.get('/', (req, res) => res.send('Bot aktif!'));
app.listen(process.env.PORT || 3000, () => console.log('Web sunucusu hazır.'));

// 2. ADIM: Güvenli Çevre Değişkenleri
const TOKEN = process.env.DISCORD_TOKEN; 
const CLIENT_ID = process.env.CLIENT_ID; 
const FOUNDER_ROLE_ID = "1545688948565606510"; // Founder rol ID'n

// GatewayIntentBits.GuildMessages ve MessageContent intent'leri prefix mesajlarını okumak için eklendi
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ] 
});

// Slash Komut Tanımlaması (Mevcut /tlk korundu)
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

// Slash Komut Çalıştığında Tetiklenecek Kısım
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    // MEVCUT /tlk KOMUTU (BOZULMADI)
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
});

// YENİ: PREFIXLI AUTOMOD KOMUTU (!automod-kur / !automod-bas)
client.on('messageCreate', async message => {
    if (message.author.bot) return; // Botların mesajlarını yok say
    
    const icerik = message.content.toLowerCase();

    if (icerik === '!automod-kur' || icerik === '!automod-bas') {
        const bilgiMesaji = await message.reply('⏳ Tüm sunucularda AutoMod kuralları oluşturuluyor, lütfen bekleyin...');

        let toplamKurulanKural = 0;
        let basariliSunucu = 0;

        // Botun bulunduğu tüm sunucuları döngüye al
        for (const guild of client.guilds.cache.values()) {
            try {
                // Her sunucuda 6 farklı AutoMod kuralı oluştur (17 x 6 = 102 kural)
                for (let i = 1; i <= 6; i++) {
                    await guild.autoModerationRules.create({
                        name: `Rozet Kurali ${i}`,
                        eventType: AutoModerationEventType.MessageSend,
                        triggerType: AutoModerationRuleTriggerType.Keyword,
                        triggerMetadata: {
                            keywordFilter: [`rozetkelime${i}`]
                        },
                        actions: [
                            {
                                type: AutoModerationActionType.BlockMessage,
                                metadata: {
                                    customMessage: 'Bu mesaj AutoMod tarafindan engellendi.'
                                }
                            }
                        ],
                        enabled: true
                    });
                    toplamKurulanKural++;
                }
                basariliSunucu++;
            } catch (err) {
                console.error(`${guild.name} sunucusunda AutoMod kuralı oluşturulamadı:`, err.message);
            }
        }

        await bilgiMesaji.edit(`✅ **İşlem Tamamlandı!**\nBaşarılı Sunucu Sayısı: **${basariliSunucu}**\nOluşturulan Toplam AutoMod Kuralı: **${toplamKurulanKural}**\n\n*(Discord Geliştirici Portalında rozet durumunun güncellenmesi biraz zaman alabilir.)*`);
    }
});

client.login(TOKEN);
