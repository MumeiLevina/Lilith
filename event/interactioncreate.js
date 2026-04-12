const User = require('../models/user');
const Conversation = require('../models/conversation');
const { handleGeminiRequest } = require('../utils/geminihandler');
const { createRoleplayEmbed } = require('../utils/embeds');
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    MessageFlags
} = require('discord.js');

const DISCORD_ERROR_UNKNOWN_INTERACTION = 10062;
const DISCORD_ERROR_ALREADY_ACKNOWLEDGED = 40060;

async function sendInteractionError(interaction, content) {
    try {
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
        } else {
            await interaction.reply({ content, flags: MessageFlags.Ephemeral });
        }
    } catch (responseError) {
        // DISCORD_ERROR_UNKNOWN_INTERACTION: interaction token expired/unknown.
        // DISCORD_ERROR_ALREADY_ACKNOWLEDGED: interaction was already acknowledged.
        if (![DISCORD_ERROR_UNKNOWN_INTERACTION, DISCORD_ERROR_ALREADY_ACKNOWLEDGED].includes(responseError?.code)) {
            console.error('Failed to send interaction error response:', responseError);
        }
    }
}

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        try {
            if (interaction.isChatInputCommand()) {
                const command = interaction.client.commands.get(interaction.commandName);

                if (!command) return;

                try {
                    await command.execute(interaction);
                } catch (error) {
                    console.error(error);
                    await sendInteractionError(interaction, 'There was an error executing this command!');
                }
                return;
            }

            if (interaction.isButton()) {
                if (interaction.customId === 'continue_roleplay') {
                    const modal = new ModalBuilder()
                        .setCustomId('continue_roleplay_modal')
                        .setTitle('Continue Roleplay');
                    
                    const messageInput = new TextInputBuilder()
                        .setCustomId('message')
                        .setLabel('Your message')
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true);
                    
                    const firstRow = new ActionRowBuilder().addComponents(messageInput);
                    modal.addComponents(firstRow);
                    
                    await interaction.showModal(modal);
                }
                
                else if (interaction.customId === 'end_roleplay') {
                    await Conversation.findOneAndUpdate(
                        { userId: interaction.user.id, isActive: true },
                        { isActive: false }
                    );
                    
                    await interaction.reply({
                        content: 'Roleplay conversation ended. Start a new one with `/roleplay`!',
                        ephemeral: true
                    });
                }
                
                else if (interaction.customId === 'change_character') {
                    const user = await User.findOne({ userId: interaction.user.id });
                    
                    if (!user || user.characterProfiles.length === 0) {
                        await interaction.reply({
                            content: 'Bạn cần tạo hồ sơ nhân vật trước! Sử dụng lệnh `/settings create_character`.',
                            ephemeral: true
                        });
                        return;
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
                    
                    const row = new ActionRowBuilder()
                        .addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId('select_roleplay_character_by_index')
                                .setPlaceholder('Chọn một nhân vật')
                                .addOptions(characterOptions)
                        );
                    
                    await interaction.reply({
                        content: 'Chọn một nhân vật để tiếp tục cuộc trò chuyện:',
                        components: [row],
                        ephemeral: true
                    });
                }
                
                else if (interaction.customId === 'cancel_delete') {
                    await interaction.update({
                        content: 'Hành động xóa nhân vật đã bị hủy.',
                        components: []
                    });
                }
                
                else if (interaction.customId.startsWith('confirm_delete_')) {
                    try {
                        // Lấy index từ customId (confirm_delete_X)
                        const index = parseInt(interaction.customId.split('_')[2]);
                        
                        // Lấy thông tin user để có danh sách nhân vật
                        const user = await User.findOne({ userId: interaction.user.id });
                        
                        if (!user || !user.characterProfiles || index >= user.characterProfiles.length) {
                            await interaction.update({
                                content: `Lỗi: Không tìm thấy nhân vật để xóa.`,
                                components: []
                            });
                            return;
                        }
                        
                        // Lưu tên nhân vật trước khi xóa để hiển thị thông báo
                        const characterName = user.characterProfiles[index].name;
                        
                        // Kiểm tra xem nhân vật này có phải là mặc định không
                        const isDefault = user.defaultCharacterName === characterName;
                        
                        // Xóa nhân vật khỏi mảng characterProfiles
                        user.characterProfiles.splice(index, 1);
                        
                        // Nếu là nhân vật mặc định, xóa nhân vật mặc định
                        if (isDefault) {
                            user.defaultCharacterName = user.characterProfiles.length > 0 ? 
                                user.characterProfiles[0].name : null;
                        }
                        
                        // Lưu lại user
                        await user.save();
                        
                        // Cập nhật các cuộc trò chuyện hiện tại nếu đang sử dụng nhân vật bị xóa
                        await Conversation.updateMany(
                            { userId: interaction.user.id, characterName: characterName },
                            { $set: { isActive: false } }
                        );
                        
                        await interaction.update({
                            content: `Đã xóa nhân vật **${characterName}**${isDefault ? `. Nhân vật mặc định đã được chuyển sang ${user.defaultCharacterName || 'không có nhân vật'}` : ''}`,
                            components: []
                        });
                    } catch (error) {
                        console.error('Error in confirm_delete:', error);
                        await interaction.update({
                            content: `Đã xảy ra lỗi khi xóa nhân vật: ${error.message}`,
                            components: []
                        });
                    }
                }
            }
            
            // Handle select menu interactions
            if (interaction.isStringSelectMenu()) {
                if (interaction.customId === 'select_default_character') {
                    try {
                        const characterName = interaction.values[0];
                        
                        // Kiểm tra xem có giá trị không
                        if (!characterName) {
                            await interaction.update({
                                content: `Lỗi: Không có nhân vật nào được chọn.`,
                                components: []
                            });
                            return;
                        }
                        
                        await User.findOneAndUpdate(
                            { userId: interaction.user.id },
                            { defaultCharacterName: characterName }
                        );
                        
                        await interaction.update({
                            content: `Nhân vật mặc định đã được cập nhật thành: **${characterName}**`,
                            components: []
                        });
                    } catch (error) {
                        console.error('Error in select_default_character:', error);
                        await interaction.update({
                            content: `Đã xảy ra lỗi khi cập nhật nhân vật mặc định: ${error.message}`,
                            components: []
                        });
                    }
                }
                
                else if (interaction.customId === 'select_character_by_index') {
                    try {
                        const characterIndex = interaction.values[0];
                        
                        // Lấy index từ giá trị (format: character_X)
                        const index = parseInt(characterIndex.split('_')[1]);
                        
                        // Lấy thông tin user để có danh sách nhân vật
                        const user = await User.findOne({ userId: interaction.user.id });
                        
                        if (!user || !user.characterProfiles || index >= user.characterProfiles.length) {
                            await interaction.update({
                                content: `Lỗi: Không tìm thấy nhân vật được chọn.`,
                                components: []
                            });
                            return;
                        }
                        
                        // Lấy tên nhân vật từ index
                        const characterName = user.characterProfiles[index].name;
                        
                        // Cập nhật nhân vật mặc định
                        await User.findOneAndUpdate(
                            { userId: interaction.user.id },
                            { defaultCharacterName: characterName }
                        );
                        
                        await interaction.update({
                            content: `Nhân vật mặc định đã được cập nhật thành: **${characterName}**`,
                            components: []
                        });
                    } catch (error) {
                        console.error('Error in select_character_by_index:', error);
                        await interaction.update({
                            content: `Đã xảy ra lỗi khi cập nhật nhân vật mặc định: ${error.message}`,
                            components: []
                        });
                    }
                }
                
                else if (interaction.customId === 'select_language') {
                    const language = interaction.values[0];
                    
                    await User.findOneAndUpdate(
                        { userId: interaction.user.id },
                        { preferredLanguage: language },
                        { upsert: true }
                    );
                    
                    await interaction.update({
                        content: `Ngôn ngữ đã được đặt thành: **${language === 'Vietnamese' ? 'Tiếng Việt' : 'Tiếng Anh'}**`,
                        components: []
                    });
                }
                
                else if (interaction.customId === 'select_roleplay_character_by_index') {
                    try {
                        const characterIndex = interaction.values[0];
                        
                        // Lấy index từ giá trị (format: character_X)
                        const index = parseInt(characterIndex.split('_')[1]);
                        
                        // Lấy thông tin user để có danh sách nhân vật
                        const user = await User.findOne({ userId: interaction.user.id });
                        
                        if (!user || !user.characterProfiles || index >= user.characterProfiles.length) {
                            await interaction.update({
                                content: `Lỗi: Không tìm thấy nhân vật được chọn.`,
                                components: []
                            });
                            return;
                        }
                        
                        // Lấy tên nhân vật từ index
                        const characterName = user.characterProfiles[index].name;
                        
                        const conversation = await Conversation.findOneAndUpdate(
                            { userId: interaction.user.id, isActive: true },
                            { characterName: characterName },
                            { new: true }
                        );
                        
                        // Kiểm tra nếu không tìm thấy cuộc trò chuyện, tạo mới
                        if (!conversation) {
                            await new Conversation({
                                userId: interaction.user.id,
                                characterName: characterName,
                                isActive: true,
                                messages: []
                            }).save();
                        }
                        
                        await interaction.update({
                            content: `Đã chuyển sang nhân vật: **${characterName}**. Bạn có thể tiếp tục cuộc trò chuyện!`,
                            components: []
                        });
                    } catch (error) {
                        console.error('Error in select_roleplay_character_by_index:', error);
                        await interaction.update({
                            content: `Đã xảy ra lỗi khi thay đổi nhân vật: ${error.message}`,
                            components: []
                        });
                    }
                }
                
                else if (interaction.customId === 'select_character_to_delete') {
                    try {
                        const characterIndex = interaction.values[0];
                        
                        // Lấy index từ giá trị (format: delete_character_X)
                        const index = parseInt(characterIndex.split('_')[2]);
                        
                        // Lấy thông tin user để có danh sách nhân vật
                        const user = await User.findOne({ userId: interaction.user.id });
                        
                        if (!user || !user.characterProfiles || index >= user.characterProfiles.length) {
                            await interaction.update({
                                content: `Lỗi: Không tìm thấy nhân vật được chọn.`,
                                components: []
                            });
                            return;
                        }
                        
                        // Lấy tên nhân vật để hiển thị thông báo
                        const characterName = user.characterProfiles[index].name;
                        
                        // Tạo các nút xác nhận xóa
                        const confirmRow = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`confirm_delete_${index}`)
                                    .setLabel('Xác nhận xóa')
                                    .setStyle(ButtonStyle.Danger),
                                new ButtonBuilder()
                                    .setCustomId('cancel_delete')
                                    .setLabel('Hủy')
                                    .setStyle(ButtonStyle.Secondary)
                            );
                        
                        await interaction.update({
                            content: `Bạn có chắc chắn muốn xóa nhân vật **${characterName}**?\n\nHành động này không thể hoàn tác.`,
                            components: [confirmRow]
                        });
                    } catch (error) {
                        console.error('Error in select_character_to_delete:', error);
                        await interaction.update({
                            content: `Đã xảy ra lỗi khi chuẩn bị xóa nhân vật: ${error.message}`,
                            components: []
                        });
                    }
                }
                
                else if (interaction.customId === 'select_roleplay_character') {
                    // Giữ lại handler cũ cho compatibility với các tương tác đang có
                    const characterName = interaction.values[0];
                    
                    try {
                        const conversation = await Conversation.findOneAndUpdate(
                            { userId: interaction.user.id, isActive: true },
                            { characterName: characterName },
                            { new: true }
                        );
                        
                        // Kiểm tra nếu không tìm thấy cuộc trò chuyện, tạo mới
                        if (!conversation) {
                            await new Conversation({
                                userId: interaction.user.id,
                                characterName: characterName,
                                isActive: true,
                                messages: []
                            }).save();
                        }
                        
                        await interaction.update({
                            content: `Đã chuyển sang nhân vật: **${characterName}**. Bạn có thể tiếp tục cuộc trò chuyện!`,
                            components: []
                        });
                    } catch (error) {
                        console.error('Error in select_roleplay_character:', error);
                        await interaction.update({
                            content: `Đã xảy ra lỗi khi thay đổi nhân vật: ${error.message}`,
                            components: []
                        });
                    }
                }
                
                // Response style handlers
                else if (interaction.customId === 'select_response_length') {
                    const length = interaction.values[0];
                    
                    await User.findOneAndUpdate(
                        { userId: interaction.user.id },
                        { 'responseStyle.length': length },
                        { upsert: true }
                    );
                    
                    const lengthLabels = {
                        'short': 'Ngắn gọn',
                        'medium': 'Trung bình',
                        'long': 'Dài',
                        'poetic': 'Thơ mộng (Poetic)'
                    };
                    
                    await interaction.reply({
                        content: `Độ dài phản hồi đã được đặt thành: **${lengthLabels[length]}**`,
                        ephemeral: true
                    });
                }
                
                else if (interaction.customId === 'select_poetic_level') {
                    const level = parseInt(interaction.values[0]);
                    
                    await User.findOneAndUpdate(
                        { userId: interaction.user.id },
                        { 'responseStyle.poeticLevel': level },
                        { upsert: true }
                    );
                    
                    await interaction.reply({
                        content: `Mức độ thơ mộng đã được đặt thành: **${level}/5**`,
                        ephemeral: true
                    });
                }
                
                else if (interaction.customId === 'select_detail_level') {
                    const level = parseInt(interaction.values[0]);
                    
                    await User.findOneAndUpdate(
                        { userId: interaction.user.id },
                        { 'responseStyle.detailLevel': level },
                        { upsert: true }
                    );
                    
                    await interaction.reply({
                        content: `Mức độ chi tiết đã được đặt thành: **${level}/5**`,
                        ephemeral: true
                    });
                }
            }
            
            // Handle modal submissions
            if (interaction.isModalSubmit()) {
                if (interaction.customId === 'create_character_modal') {
                    const characterName = interaction.fields.getTextInputValue('characterName');
                    const characterPersonality = interaction.fields.getTextInputValue('characterPersonality');
                    const characterAppearance = interaction.fields.getTextInputValue('characterAppearance');
                    
                    await User.findOneAndUpdate(
                        { userId: interaction.user.id },
                        { 
                            $push: { 
                                characterProfiles: {
                                    name: characterName,
                                    personality: characterPersonality,
                                    appearance: characterAppearance
                                }
                            }
                        },
                        { upsert: true }
                    );
                    
                    await interaction.reply({
                        content: `Nhân vật **${characterName}** đã được tạo thành công!`,
                        ephemeral: true
                    });
                }
                
                else if (interaction.customId === 'personality_modal') {
                    const botPersonality = interaction.fields.getTextInputValue('botPersonality');
                    
                    await User.findOneAndUpdate(
                        { userId: interaction.user.id },
                        { customBotPersonality: botPersonality },
                        { upsert: true }
                    );
                    
                    await interaction.reply({
                        content: `Tính cách của bot đã được cập nhật thành: **${botPersonality}**`,
                        ephemeral: true
                    });
                }
                
                else if (interaction.customId === 'continue_roleplay_modal') {
                    await interaction.deferReply();
                    
                    const userMessage = interaction.fields.getTextInputValue('message');
                    
                    // Get the active conversation
                    let conversation = await Conversation.findOne({ 
                        userId: interaction.user.id,
                        isActive: true
                    });
                    
                    if (!conversation) {
                        await interaction.editReply('No active conversation found. Please start a new one with `/roleplay`.');
                        return;
                    }
                    
                    // Get user settings for character profile
                    const user = await User.findOne({ userId: interaction.user.id });
                    const characterProfile = user.characterProfiles.find(
                        profile => profile.name === conversation.characterName
                    ) || {
                        name: conversation.characterName,
                        personality: 'A kind and helpful AI assistant.',
                        appearance: 'Has no specific appearance details.'
                    };
                    
                    // Add user message to conversation
                    conversation.messages.push({ 
                        role: 'user', 
                        content: userMessage 
                    });
                    
                    // Get AI response
                    const aiResponse = await handleGeminiRequest(conversation.messages, characterProfile);
                    
                    // Add AI response to conversation
                    conversation.messages.push({
                        role: 'assistant',
                        content: aiResponse
                    });
                    
                    // Giới hạn số tin nhắn trong database (giữ 40 tin nhắn gần nhất)
                    if (conversation.messages.length > 40) {
                        conversation.messages = conversation.messages.slice(-40);
                    }
                    
                    // Save conversation
                    await conversation.save();
                    
                    // Create UI elements
                    const row = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('continue_roleplay')
                                .setLabel('Continue')
                                .setStyle(ButtonStyle.Primary),
                            new ButtonBuilder()
                                .setCustomId('end_roleplay')
                                .setLabel('End Conversation')
                                .setStyle(ButtonStyle.Danger),
                            new ButtonBuilder()
                                .setCustomId('change_character')
                                .setLabel('Change Character')
                                .setStyle(ButtonStyle.Secondary)
                        );
                    
                    // Send response
                    const embed = createRoleplayEmbed(
                        conversation.characterName, 
                        aiResponse, 
                        characterProfile.appearance
                    );
                    
                    await interaction.editReply({ embeds: [embed], components: [row] });
                }
            }
            
        } catch (error) {
            console.error('Error in interactionCreate event:', error);
            await sendInteractionError(interaction, 'There was an error processing your interaction.');
        }
    }
};
