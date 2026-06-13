const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require('discord.js');
const { hasDjPermission } = require('../utils/music');
const { buildDashboardUrl } = require('../utils/dashboard');
const {
    addDashboardCollaborator,
    getCollaboratorIds,
    removeDashboardCollaborator
} = require('../utils/dashboardAccess');

async function ensureDashboardManager(interaction) {
    if (hasDjPermission(interaction.member)) {
        return true;
    }

    await interaction.reply({
        content: 'Bạn cần role DJ hoặc quyền quản trị để quản lý quyền truy cập dashboard.',
        flags: MessageFlags.Ephemeral
    });
    return false;
}

function buildDashboardButtonRow(url) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel('Mở Music Dashboard')
            .setURL(url)
            .setStyle(ButtonStyle.Link)
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dashboard')
        .setDescription('Lấy link và quản lý quyền truy cập Music Dashboard')
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand
                .setName('link')
                .setDescription('Lấy link Music Dashboard cho server hiện tại')
                .addBooleanOption(option =>
                    option
                        .setName('public')
                        .setDescription('Gửi link công khai trong kênh (mặc định là riêng tư)')))
        .addSubcommand(subcommand =>
            subcommand
                .setName('grant')
                .setDescription('Cấp quyền dashboard cho một thành viên')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('Thành viên cần cấp quyền')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('revoke')
                .setDescription('Thu hồi quyền dashboard của một thành viên')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('Thành viên cần thu hồi quyền')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Xem danh sách thành viên đang được cấp quyền dashboard')),

    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'link') {
                const dashboardUrl = buildDashboardUrl(interaction.guildId);
                if (!dashboardUrl) {
                    await interaction.reply({
                        content: 'Không tạo được link dashboard. Vui lòng kiểm tra biến môi trường `WEB_DASHBOARD_URL` hoặc `WEB_ORIGIN`.',
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                const isPublic = interaction.options.getBoolean('public') === true;
                const embed = new EmbedBuilder()
                    .setColor('#6D9EEB')
                    .setTitle('🎛️ Music Dashboard')
                    .setDescription('Dùng link bên dưới để mở trang điều khiển nhạc cho server này.')
                    .addFields(
                        {
                            name: 'Quyền truy cập',
                            value: 'Chỉ DJ/Admin hoặc thành viên được cấp qua `/dashboard grant` mới dùng được dashboard.'
                        }
                    );

                const replyPayload = {
                    embeds: [embed],
                    components: [buildDashboardButtonRow(dashboardUrl)]
                };

                if (!isPublic) {
                    replyPayload.flags = MessageFlags.Ephemeral;
                }

                await interaction.reply(replyPayload);
                return;
            }

            if (!await ensureDashboardManager(interaction)) {
                return;
            }

            if (subcommand === 'grant') {
                const targetUser = interaction.options.getUser('user', true);

                if (targetUser.bot) {
                    await interaction.reply({
                        content: 'Không thể cấp quyền dashboard cho bot.',
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
                if (!targetMember) {
                    await interaction.reply({
                        content: 'Thành viên này không có trong server hiện tại.',
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                if (hasDjPermission(targetMember)) {
                    await interaction.reply({
                        content: `${targetUser} đã có quyền dashboard vì đang là DJ/Admin.`,
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                const collaboratorIds = await addDashboardCollaborator(interaction.guildId, targetUser.id, interaction.user.id);
                await interaction.reply({
                    content: `Đã cấp quyền dashboard cho ${targetUser}. Hiện có ${collaboratorIds.length} cộng tác viên.`,
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            if (subcommand === 'revoke') {
                const targetUser = interaction.options.getUser('user', true);
                const collaboratorIds = await removeDashboardCollaborator(interaction.guildId, targetUser.id, interaction.user.id);

                await interaction.reply({
                    content: `Đã thu hồi quyền dashboard của ${targetUser}. Còn ${collaboratorIds.length} cộng tác viên.`,
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            if (subcommand === 'list') {
                const collaboratorIds = await getCollaboratorIds(interaction.guildId);

                if (!collaboratorIds.length) {
                    await interaction.reply({
                        content: 'Hiện chưa có cộng tác viên nào được cấp quyền dashboard.',
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                const preview = collaboratorIds.slice(0, 20).map(id => `<@${id}>`).join('\n');
                const extraCount = collaboratorIds.length > 20
                    ? `\n...và ${collaboratorIds.length - 20} thành viên khác.`
                    : '';

                await interaction.reply({
                    content: `Danh sách cộng tác viên dashboard:\n${preview}${extraCount}`,
                    flags: MessageFlags.Ephemeral
                });
            }
        } catch (error) {
            console.error('Dashboard command error:', error);

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: 'Đã xảy ra lỗi khi xử lý lệnh dashboard. Vui lòng thử lại sau.',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            await interaction.reply({
                content: 'Đã xảy ra lỗi khi xử lý lệnh dashboard. Vui lòng thử lại sau.',
                flags: MessageFlags.Ephemeral
            });
        }
    }
};
