const { Client, GatewayIntentBits, REST, Routes, ApplicationCommandOptionType } = require('discord.js');
const express = require('express');

// 1. ADIM: Render/Replit Kesintisiz Çalışma Hilesi (Web Sunucusu)
const app = express();
app.get('/', (req, res) => res.send('Bot aktif!'));
app.listen(process.env.PORT || 3000, () => console.log('Web sunucusu hazır.'));

// 2. ADIM: Güvenli Çevre Değişkenleri (Token'lar Panellerden Çekilecek)
const TOKEN = process.env.DISCORD_TOKEN; 
const CLIENT_ID = process.env.CLIENT_ID; 
const FOUNDER_ROLE_ID = "1545688948565606510"; // Senin Founder rol ID'n

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Slash Komut Tanımlaması
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

// Komut Çalıştığında Tetiklenecek Kısım
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'tlk') {
        // Rol Kontrolü
        if (!interaction.member.roles.cache.has(FOUNDER_ROLE_ID)) {
            return interaction.reply({ 
                content: '❌ Bu komutu sadece Founder kullanabilir.', 
                ephemeral: true 
            });
        }

        const gonderilecekMesaj = interaction.options.getString('mesaj');

        // Üstteki "kullandı" yazısını tamamen gizleyen sihirli tetikleyici
        await interaction.deferReply({ ephemeral: true });
        
        // Kanala tamamen bağımsız, normal mesaj atar
        await interaction.channel.send(gonderilecekMesaj);

        // Arka plandaki gizli işlemi temizler
        await interaction.deleteReply();
    }
});

client.login(TOKEN);

