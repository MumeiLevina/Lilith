const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban một người dùng khỏi server')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Người dùng cần ban')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Lý do ban người dùng')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('appeal_link')
                .setDescription('Đường link kháng cáo (URL)')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    
    async execute(interaction) {
        try {
            // Kiểm tra quyền của người thực hiện lệnh
            if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
                return interaction.reply({ 
                    content: 'Bạn không có quyền ban thành viên!', 
                    ephemeral: true 
                });
            }

            const targetUser = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason');
            const appealLink = interaction.options.getString('appeal_link') || 'Không có link kháng cáo';
            const targetMember = interaction.guild.members.cache.get(targetUser.id);

            // Kiểm tra nếu người dùng không tồn tại trong server
            if (!targetMember) {
                return interaction.reply({ 
                    content: ' Không tìm thấy người dùng này trong server!', 
                    ephemeral: true 
                });
            }

            // Kiểm tra nếu người dùng là chính mình
            if (targetUser.id === interaction.user.id) {
                return interaction.reply({ 
                    content: ' Bạn không thể tự ban chính mình!', 
                    ephemeral: true 
                });
            }

            // Kiểm tra nếu người dùng là chủ server
            if (targetUser.id === interaction.guild.ownerId) {
                return interaction.reply({ 
                    content: ' Bạn không thể ban chủ server!', 
                    ephemeral: true 
                });
            }

            // Kiểm tra nếu bot có quyền cao hơn người dùng cần ban
            if (targetMember.roles.highest.position >= interaction.guild.members.me.roles.highest.position) {
                return interaction.reply({ 
                    content: ' Tôi không thể ban người dùng này vì họ có vai trò cao hơn hoặc bằng vai trò của tôi!', 
                    ephemeral: true 
                });
            }

            // Kiểm tra nếu người thực hiện lệnh có vai trò cao hơn người cần ban
            if (targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
                return interaction.reply({ 
                    content: ' Bạn không thể ban người dùng này vì họ có vai trò cao hơn hoặc bằng vai trò của bạn!', 
                    ephemeral: true 
                });
            }

            await interaction.deferReply();

            // Tạo embed thông báo cho người bị ban
            const dmEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(' Bạn đã bị ban!')
                .setDescription(`Bạn đã bị ban khỏi server **${interaction.guild.name}**`)
                .addFields(
                    { name: ' Lý do', value: reason, inline: false },
                    { name: ' Link kháng cáo', value: appealLink, inline: false }
                )
                .setThumbnail(interaction.guild.iconURL())
                .setFooter({ text: 'Lilith Bot - Ban System' })
                .setTimestamp();

            // Gửi DM cho người bị ban
            let dmSent = false;
            try {
                await targetUser.send({ embeds: [dmEmbed] });
                dmSent = true;
            } catch (error) {
                console.log(`Không thể gửi DM cho ${targetUser.tag}. Họ có thể đã tắt DM.`);
            }

            // Thực hiện ban
            await targetMember.ban({ 
                reason: `${reason} | Bởi: ${interaction.user.tag}` 
            });

            // Tạo embed thông báo thành công trong server
            const successEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle(' Ban thành công!')
                .setDescription(`**${targetUser.tag}** đã bị ban khỏi server`)
                .addFields(
                    { name: ' Người bị ban', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                    { name: ' Lý do', value: reason, inline: false },
                    { name: ' Link kháng cáo', value: appealLink, inline: false },
                    { name: ' Thông báo DM', value: dmSent ? ' Đã gửi' : ' Không gửi được (DM đóng)', inline: false }
                )
                .setThumbnail(targetUser.displayAvatarURL())
                .setFooter({ text: 'Lilith Bot - Ban System' })
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });

        } catch (error) {
            console.error('Error executing ban command:', error);
            
            const errorMessage = {
                content: ' Có lỗi xảy ra khi thực hiện lệnh ban. Vui lòng thử lại sau!',
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
