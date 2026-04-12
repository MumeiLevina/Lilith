require('dotenv').config();
const { Client, GatewayIntentBits, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { Player } = require('discord-player');
const { DefaultExtractors } = require('@discord-player/extractor');

const BUTTON_COLLECTOR_TIMEOUT_MS = 15 * 60 * 1000;

// Create client instance
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ] 
});

// Collections
client.commands = new Collection();
client.cooldowns = new Collection();
client.player = new Player(client);

client.player.extractors.loadMulti(DefaultExtractors).catch(error => {
    console.error('Failed to load music extractors:', error);
});

client.player.events.on('connection', queue => {
    queue.metadata?.channel?.send(`🎧 Đã tham gia kênh voice **${queue.channel?.name || 'Unknown'}**.`);
});

client.player.events.on('playerStart', async (queue, track) => {
    const channel = queue.metadata?.channel;
    if (!channel) return;

    const controls = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('music_skip')
            .setLabel('⏭️ Skip')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('music_stop')
            .setLabel('⏹️ Stop')
            .setStyle(ButtonStyle.Danger)
    );

    const nowPlayingEmbed = new EmbedBuilder()
        .setColor('#6D9EEB')
        .setTitle('🎶 Đang phát bài mới')
        .setDescription(`**${track.cleanTitle}**`)
        .addFields(
            { name: 'Thời lượng', value: track.duration || 'Không rõ', inline: true },
            { name: 'Yêu cầu bởi', value: `${track.requestedBy || 'Unknown'}`, inline: true }
        );

    if (track.thumbnail) {
        nowPlayingEmbed.setThumbnail(track.thumbnail);
    }

    const message = await channel.send({ embeds: [nowPlayingEmbed], components: [controls] });
    const collector = message.createMessageComponentCollector({ time: BUTTON_COLLECTOR_TIMEOUT_MS });

    collector.on('collect', async interaction => {
        if (!interaction.isButton()) return;
        const queue = interaction.client.player.nodes.get(interaction.guildId);

        if (!queue || !queue.currentTrack) {
            await interaction.reply({ content: 'Không còn bài nào trong hàng đợi.', ephemeral: true });
            return;
        }

        const memberVoiceChannel = interaction.member?.voice?.channelId;
        const botVoiceChannel = interaction.guild?.members.me?.voice?.channelId;

        if (!memberVoiceChannel || memberVoiceChannel !== botVoiceChannel) {
            await interaction.reply({
                content: 'Bạn cần ở cùng kênh voice với bot để dùng nút điều khiển.',
                ephemeral: true
            });
            return;
        }

        if (interaction.customId === 'music_skip') {
            const skipped = queue.node.skip();
            await interaction.reply({
                content: skipped ? '⏭️ Đã chuyển sang bài tiếp theo.' : 'Không thể skip lúc này.',
                ephemeral: true
            });
            return;
        }

        if (interaction.customId === 'music_stop') {
            queue.delete();
            await interaction.reply({ content: '⏹️ Đã dừng nhạc và xóa hàng đợi.', ephemeral: true });
        }
    });
});

client.player.events.on('emptyQueue', queue => {
    queue.metadata?.channel?.send('✅ Hàng đợi trống, bot sẽ rời kênh voice.');
    queue.delete();
});

client.player.events.on('error', (queue, error) => {
    console.error('Music queue error:', error);
    queue?.metadata?.channel?.send('⚠️ Đã xảy ra lỗi khi phát nhạc.');
});

client.player.events.on('playerError', (queue, error) => {
    console.error('Music player error:', error);
    queue?.metadata?.channel?.send('⚠️ Không thể phát bài hát này, đang thử bài kế tiếp.');
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Load commands
const commandsPath = path.join(__dirname, 'command');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing required properties.`);
    }
}

// Load events
const eventsPath = path.join(__dirname, 'event');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

// Login to Discord
client.login(process.env.DISCORD_TOKEN);
