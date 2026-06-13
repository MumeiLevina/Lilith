const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Gỡ ban cho một người dùng')
        .addStringOption(option =>
            option
                .setName('user_id')
                .setDescription('ID của người dùng cần gỡ ban')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Lý do gỡ ban')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    
    async execute(interaction) {
        try {
            // Kiểm tra quyền của người thực hiện lệnh
            if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
                return interaction.reply({ 
                    content: ' Bạn không có quyền gỡ ban thành viên', 
                    ephemeral: true 
                });
            }

            const userId = interaction.options.getString('user_id');
            const reason = interaction.options.getString('reason') || 'Không có lý do cụ thể';

            await interaction.deferReply();

            // Lấy danh sách người bị ban
            const bans = await interaction.guild.bans.fetch();
            const bannedUser = bans.get(userId);

            // Kiểm tra nếu người dùng không bị ban
            if (!bannedUser) {
                return interaction.editReply({ 
                    content: ' Người dùng này không bị ban hoặc ID không đúng' 
                });
            }

            // Lấy thông tin user
            const user = bannedUser.user;

            // Thực hiện unban
            await interaction.guild.members.unban(userId, `${reason} | Bởi: ${interaction.user.tag}`);

            // Tạo embed thông báo cho người được unban
            const dmEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle(' Bạn đã được gỡ ban!')
                .setDescription(`Bạn đã được gỡ ban khỏi server **${interaction.guild.name}**`)
                .addFields(
                    { name: ' Lý do', value: reason, inline: false },
                    { name: ' Người thực hiện', value: `${interaction.user.tag}`, inline: false },
                    { name: ' Link server', value: 'Bạn có thể tham gia lại server!', inline: false }
                )
                .setThumbnail(interaction.guild.iconURL())
                .setFooter({ text: 'Lilith Bot - Unban System' })
                .setTimestamp();

            // Gửi DM cho người được unban
            let dmSent = false;
            try {
                await user.send({ embeds: [dmEmbed] });
                dmSent = true;
            } catch (error) {
                console.log(`Không thể gửi DM cho ${user.tag}. Họ có thể đã tắt DM hoặc chặn bot.`);
            }

            // Tạo embed thông báo thành công trong server
            const successEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle(' Gỡ ban thành công!')
                .setDescription(`**${user.tag}** đã được gỡ ban khỏi server`)
                .addFields(
                    { name: ' Người được unban', value: `${user.tag} (${user.id})`, inline: true },
                    { name: ' Người thực hiện', value: `${interaction.user.tag}`, inline: true },
                    { name: ' Lý do', value: reason, inline: false },
                    { name: ' Thông báo DM', value: dmSent ? ' Đã gửi' : ' Không gửi được (DM đóng hoặc bot bị chặn)', inline: false }
                )
                .setThumbnail(user.displayAvatarURL())
                .setFooter({ text: 'Lilith Bot - Unban System' })
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });

        } catch (error) {
            console.error('Error executing unban command:', error);
            
            const errorMessage = {
                content: ' Có lỗi xảy ra khi thực hiện lệnh unban. Vui lòng kiểm tra lại ID và thử lại!',
                ephemeral: true
            };

            if (interaction.deferred) {
                await interaction.editReply(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    }
};
