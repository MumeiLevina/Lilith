const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Hiển thị danh sách các lệnh có sẵn'),
    
    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor('#FF9DD1')
            .setTitle('Lilith Bot - Danh Sách Lệnh')
            .setDescription('Chào mừng bạn đến với Lilith Bot! Dưới đây là các lệnh bạn có thể sử dụng:')
            .addFields(
                { name: '`/roleplay [tin nhắn]`', value: 'Bắt đầu hoặc tiếp tục cuộc trò chuyện roleplay với nhân vật' },
                { name: '`/settings view`', value: 'Xem cài đặt hiện tại của bạn' },
                { name: '`/settings create_character`', value: 'Tạo một hồ sơ nhân vật mới' },
                { name: '`/settings change_character`', value: 'Thay đổi nhân vật mặc định' },
                { name: '`/settings delete_character`', value: 'Xóa một nhân vật đã tạo' },
                { name: '`/settings language`', value: 'Đặt ngôn ngữ ưa thích của bạn' },
                { name: '`/settings personality`', value: 'Tùy chỉnh tính cách của bot' },
                { name: '`/music play [query]`', value: 'Phát nhạc hoặc thêm vào hàng chờ' },
                { name: '`/music queue`', value: 'Xem hàng chờ nhạc hiện tại' },
                { name: '`/music skip|pause|resume|stop|volume`', value: 'Điều khiển trình phát nhạc' },
                { name: '`/help`', value: 'Hiển thị thông báo trợ giúp này' }
            )
            .addFields(
                { name: 'Cách sử dụng', value: 'Bạn cũng có thể nhắn tin trực tiếp bằng cách đề cập đến bot: `@Lilith [tin nhắn của bạn]`' }
            )
            .setImage('https://www.google.com/url?sa=i&url=https%3A%2F%2Fza.pinterest.com%2Fbradleyperelaer%2Fnoexistencen%2F&psig=AOvVaw0cnl0pV-2puUZ1J1QGn3Jf&ust=1754480013384000&source=images&cd=vfe&opi=89978449&ved=0CBUQjRxqFwoTCICJvb7J844DFQAAAAAdAAAAABAE')
            .setFooter({ text: 'Lilith Bot' })
            .setTimestamp();
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('Hỗ Trợ')
                    .setURL('https://discord.gg/N9Mkb8Pz')
                    .setStyle(ButtonStyle.Link),
                new ButtonBuilder()
                    .setLabel('Discord')
                    .setURL('https://discord.gg/N9Mkb8Pz')
                    .setStyle(ButtonStyle.Link)
            );
        
        await interaction.reply({ embeds: [embed], components: [row] });
    }
};
