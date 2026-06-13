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
                { name: '`/play [query]`', value: 'Phát nhạc từ link YouTube/Spotify/SoundCloud hoặc từ khóa tìm kiếm' },
                { name: '`/queue`', value: 'Xem danh sách hàng đợi phát nhạc' },
                { name: '`/nowplaying`', value: 'Hiển thị bài hát đang phát cùng tiến trình' },
                { name: '`/skip`', value: 'Bỏ qua bài hát hiện tại' },
                { name: '`/pause`', value: 'Tạm dừng bài hát hiện tại (DJ)' },
                { name: '`/resume`', value: 'Tiếp tục phát nhạc (DJ)' },
                { name: '`/stop`', value: 'Dừng phát nhạc và xóa hàng đợi' },
                { name: '`/loop [mode]`', value: 'Đặt loop mode: off/track/queue (DJ)' },
                { name: '`/autoplay [state]`', value: 'Bật/tắt autoplay khi hết queue (DJ)' },
                { name: '`/dashboard link [public]`', value: 'Lấy link vào music dashboard cho server hiện tại' },
                { name: '`/dashboard grant|revoke|list`', value: 'Quản lý bạn bè có quyền dùng dashboard (DJ/Admin)' },
                { name: '`/help`', value: 'Hiển thị thông báo trợ giúp này' }
            )
            .addFields(
                { name: 'Cách sử dụng', value: 'Bạn cũng có thể nhắn tin trực tiếp bằng cách đề cập đến bot: `@Lilith [tin nhắn của bạn]`' },
                { name: 'Ghi chú DJ', value: 'Lệnh điều khiển nhạc yêu cầu role `DJ` mặc định (có thể đổi bằng `DJ_ROLE_NAME` hoặc `DJ_ROLE_ID` trong env).' }
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
