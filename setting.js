const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, TextInputBuilder, ModalBuilder, TextInputStyle } = require('discord.js');
const User = require('../model/user');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Thay đổi cài đặt của bot')
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('Xem cài đặt hiện tại của bạn'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('create_character')
                .setDescription('Tạo một hồ sơ nhân vật mới'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('change_character')
                .setDescription('Thay đổi nhân vật mặc định'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete_character')
                .setDescription('Xóa một nhân vật đã tạo'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('language')
                .setDescription('Đặt ngôn ngữ ưa thích của bạn'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('personality')
                .setDescription('Tùy chỉnh tính cách của bot')),
    
    async execute(interaction) {
        if (interaction.options.getSubcommand() === 'view') {
            await handleViewSettings(interaction);
        } else if (interaction.options.getSubcommand() === 'create_character') {
            await handleCreateCharacter(interaction);
        } else if (interaction.options.getSubcommand() === 'change_character') {
            await handleChangeCharacter(interaction);
        } else if (interaction.options.getSubcommand() === 'delete_character') {
            await handleDeleteCharacter(interaction);
        } else if (interaction.options.getSubcommand() === 'language') {
            await handleLanguageSettings(interaction);
        } else if (interaction.options.getSubcommand() === 'personality') {
            await handlePersonalitySettings(interaction);
        }
    }
};

async function handleViewSettings(interaction) {
    try {
        const user = await User.findOne({ userId: interaction.user.id });
        
        if (!user) {
            return await interaction.reply({
                content: 'Bạn chưa có cài đặt nào. Hãy sử dụng lệnh `/settings create_character` để tạo nhân vật đầu tiên!',
                ephemeral: true
            });
        }
        
        // Kiểm tra xem có nhân vật nào không
        if (!user.characterProfiles || user.characterProfiles.length === 0) {
            return await interaction.reply({
                content: 'Bạn chưa tạo nhân vật nào. Hãy sử dụng lệnh `/settings create_character` để tạo nhân vật đầu tiên!',
                ephemeral: true
            });
        }
        
        // Tạo tùy chọn với ID làm giá trị để tránh trùng lặp
        const characterOptions = user.characterProfiles.map((profile, index) => {
            const safeDescription = profile.personality ? profile.personality.substring(0, 50) : '';
            // Sử dụng index làm giá trị để đảm bảo không có trùng lặp
            return {
                label: profile.name || 'Nhân vật không tên',
                description: safeDescription ? `${safeDescription}...` : 'Không có mô tả',
                value: `character_${index}`
            };
        });
        
        // Tạo row chỉ khi có nhân vật
        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select_character_by_index')
                    .setPlaceholder('Chọn nhân vật mặc định')
                    .addOptions(characterOptions.length > 0 ? characterOptions : [{
                        label: 'Không có nhân vật nào',
                        description: 'Hãy tạo nhân vật mới trước',
                        value: 'no_character'
                    }])
            );
        
        // Tạo thông tin hiển thị
        const language = user.preferredLanguage === 'Vietnamese' ? 'Tiếng Việt' : 'Tiếng Anh';
        const personality = user.customBotPersonality || 'Chưa cài đặt';
        const defaultCharacter = user.defaultCharacterName || 'Chưa cài đặt';
        
        await interaction.reply({
            content: `**Cài đặt của bạn:**\n\n` +
                   `**Nhân vật mặc định:** ${defaultCharacter}\n` +
                   `**Ngôn ngữ:** ${language}\n` +
                   `**Tính cách bot:** ${personality}\n\n` +
                   `Bạn có ${user.characterProfiles.length} hồ sơ nhân vật.\n` +
                   `Chọn một nhân vật từ menu bên dưới để đặt làm mặc định:`,
            components: [row],
            ephemeral: true
        });
        
    } catch (error) {
        console.error('Error in handleViewSettings:', error);
        await interaction.reply({ 
            content: 'Đã xảy ra lỗi khi xem cài đặt của bạn. Vui lòng thử lại sau.', 
            ephemeral: true 
        });
    }
}

async function handleCreateCharacter(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('create_character_modal')
        .setTitle('Tạo nhân vật mới');
    
    const nameInput = new TextInputBuilder()
        .setCustomId('characterName')
        .setLabel('Tên nhân vật')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
    
    const personalityInput = new TextInputBuilder()
        .setCustomId('characterPersonality')
        .setLabel('Tính cách')
        .setPlaceholder('Mô tả tính cách của nhân vật')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);
    
    const appearanceInput = new TextInputBuilder()
        .setCustomId('characterAppearance')
        .setLabel('Ngoại hình')
        .setPlaceholder('Mô tả ngoại hình của nhân vật')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);
    
    const firstRow = new ActionRowBuilder().addComponents(nameInput);
    const secondRow = new ActionRowBuilder().addComponents(personalityInput);
    const thirdRow = new ActionRowBuilder().addComponents(appearanceInput);
    
    modal.addComponents(firstRow, secondRow, thirdRow);
    
    await interaction.showModal(modal);
}

async function handleLanguageSettings(interaction) {
    try {
        // Tạo menu lựa chọn ngôn ngữ
        const languageSelect = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select_language')
                    .setPlaceholder('Chọn ngôn ngữ của bạn')
                    .addOptions([
                        {
                            label: 'Tiếng Việt',
                            description: 'Chọn tiếng Việt làm ngôn ngữ mặc định',
                            value: 'Vietnamese',
                        },
                        {
                            label: 'Tiếng Anh',
                            description: 'Chọn tiếng Anh làm ngôn ngữ mặc định',
                            value: 'English',
                        },
                    ]),
            );
        
        await interaction.reply({
            content: 'Vui lòng chọn ngôn ngữ của bạn:',
            components: [languageSelect],
            ephemeral: true
        });
    } catch (error) {
        console.error('Error in handleLanguageSettings:', error);
        await interaction.reply({
            content: `Đã xảy ra lỗi khi cài đặt ngôn ngữ: ${error.message}`,
            ephemeral: true
        });
    }
}

async function handleChangeCharacter(interaction) {
    try {
        const user = await User.findOne({ userId: interaction.user.id });
        
        if (!user) {
            return await interaction.reply({
                content: 'Bạn chưa có cài đặt nào. Hãy sử dụng lệnh `/settings create_character` để tạo nhân vật đầu tiên!',
                ephemeral: true
            });
        }
        
        // Kiểm tra xem có nhân vật nào không
        if (!user.characterProfiles || user.characterProfiles.length === 0) {
            return await interaction.reply({
                content: 'Bạn chưa tạo nhân vật nào. Hãy sử dụng lệnh `/settings create_character` để tạo nhân vật đầu tiên!',
                ephemeral: true
            });
        }
        
        // Tạo tùy chọn với ID làm giá trị để tránh trùng lặp
        const characterOptions = user.characterProfiles.map((profile, index) => {
            const safeDescription = profile.personality ? profile.personality.substring(0, 50) : '';
            // Sử dụng index làm giá trị để đảm bảo không có trùng lặp
            return {
                label: profile.name || 'Nhân vật không tên',
                description: safeDescription ? `${safeDescription}...` : 'Không có mô tả',
                value: `character_${index}`
            };
        });
        
        // Lưu mapping giữa index và tên nhân vật trong session
        // Bọc trong try-catch vì nếu không hỗ trợ sessionId thì bỏ qua
        try {
            // Lưu mapping vào trình quản lý phiên của bot (nếu có)
            if (interaction.client.characterSessions) {
                interaction.client.characterSessions[interaction.user.id] = user.characterProfiles.map(
                    profile => profile.name
                );
            } else {
                interaction.client.characterSessions = {};
                interaction.client.characterSessions[interaction.user.id] = user.characterProfiles.map(
                    profile => profile.name
                );
            }
        } catch (sessionError) {
            console.error('Error saving session:', sessionError);
            // Tiếp tục chạy ngay cả khi không lưu được session
        }
        
        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select_character_by_index')
                    .setPlaceholder('Chọn nhân vật mặc định')
                    .addOptions(characterOptions)
            );
        
        await interaction.reply({
            content: `**Thay đổi nhân vật mặc định**\n\nNhân vật mặc định hiện tại: **${user.defaultCharacterName || 'Chưa cài đặt'}**\n\nVui lòng chọn một nhân vật từ menu bên dưới để đặt làm mặc định:`,
            components: [row],
            ephemeral: true
        });
    } catch (error) {
        console.error('Error in handleChangeCharacter:', error);
        await interaction.reply({
            content: `Đã xảy ra lỗi khi thay đổi nhân vật: ${error.message}`,
            ephemeral: true
        });
    }
}

async function handlePersonalitySettings(interaction) {
    try {
        const modal = new ModalBuilder()
            .setCustomId('personality_modal')
            .setTitle('Tùy chỉnh tính cách bot');
        
        const personalityInput = new TextInputBuilder()
            .setCustomId('botPersonality')
            .setLabel('Mô tả tính cách')
            .setPlaceholder('Mô tả chi tiết về tính cách bạn muốn bot thể hiện')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);
        
        const firstRow = new ActionRowBuilder().addComponents(personalityInput);
        
        modal.addComponents(firstRow);
        
        await interaction.showModal(modal);
    } catch (error) {
        console.error(error);
        await interaction.reply({
            content: 'Đã xảy ra lỗi khi mở cửa sổ cài đặt tính cách.',
            ephemeral: true
        });
    }
}

async function handleDeleteCharacter(interaction) {
    try {
        const user = await User.findOne({ userId: interaction.user.id });
        
        if (!user) {
            return await interaction.reply({
                content: 'Bạn chưa có cài đặt nào. Hãy sử dụng lệnh `/settings create_character` để tạo nhân vật đầu tiên!',
                ephemeral: true
            });
        }
        
        // Kiểm tra xem có nhân vật nào không
        if (!user.characterProfiles || user.characterProfiles.length === 0) {
            return await interaction.reply({
                content: 'Bạn chưa tạo nhân vật nào. Hãy sử dụng lệnh `/settings create_character` để tạo nhân vật đầu tiên!',
                ephemeral: true
            });
        }
        
        // Tạo tùy chọn với ID làm giá trị để tránh trùng lặp
        const characterOptions = user.characterProfiles.map((profile, index) => {
            const safeDescription = profile.personality ? profile.personality.substring(0, 50) : '';
            // Sử dụng index làm giá trị để đảm bảo không có trùng lặp
            return {
                label: profile.name || 'Nhân vật không tên',
                description: safeDescription ? `${safeDescription}...` : 'Không có mô tả',
                value: `delete_character_${index}`
            };
        });
        
        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select_character_to_delete')
                    .setPlaceholder('Chọn nhân vật để xóa')
                    .addOptions(characterOptions)
            );
        
        await interaction.reply({
            content: `**Xóa nhân vật**\n\nCảnh báo: Hành động này không thể hoàn tác.\nVui lòng chọn nhân vật bạn muốn xóa từ menu bên dưới:`,
            components: [row],
            ephemeral: true
        });
    } catch (error) {
        console.error('Error in handleDeleteCharacter:', error);
        await interaction.reply({
            content: `Đã xảy ra lỗi khi chuẩn bị xóa nhân vật: ${error.message}`,
            ephemeral: true
        });
    }
}