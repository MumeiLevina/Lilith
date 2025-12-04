const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { handleOpenAIRequest } = require('../utils/openaihandler');
const User = require('../models/user');
const Conversation = require('../models/conversation');
const { createRoleplayEmbed } = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roleplay')
        .setDescription('Start or continue a roleplay conversation')
        .addStringOption(option => 
            option.setName('message')
                .setDescription('Your message to the character')
                .setRequired(true)),
    
    async execute(interaction) {
        await interaction.deferReply();
        
        try {
            const user = await User.findOneAndUpdate(
                { userId: interaction.user.id },
                { userId: interaction.user.id },
                { upsert: true, new: true }
            );
            
            let conversation = await Conversation.findOne({ 
                userId: interaction.user.id,
                isActive: true
            });
            
            if (!conversation) {
                conversation = new Conversation({
                    userId: interaction.user.id,
                    characterName: user.defaultCharacterName || 'Lilith',
                    messages: []
                });
            }
            
            const userMessage = interaction.options.getString('message');
            conversation.messages.push({ 
                role: 'user', 
                content: userMessage 
            });
            
            const characterProfile = user.characterProfiles.find(
                profile => profile.name === conversation.characterName
            ) || {
                name: 'Mumei Levina',
                personality: 'A kind and helpful AI assistant with a cheerful personality.',
                appearance: 'Has long silver hair and bright blue eyes.'
            };
            
            const aiResponse = await handleOpenAIRequest(conversation.messages, characterProfile);
            
            conversation.messages.push({
                role: 'assistant',
                content: aiResponse
            });
            
            // Giới hạn số tin nhắn trong database (giữ 40 tin nhắn gần nhất)
            if (conversation.messages.length > 40) {
                conversation.messages = conversation.messages.slice(-40);
            }
            
            await conversation.save();
            
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
            
            const embed = createRoleplayEmbed(
                conversation.characterName, 
                aiResponse, 
                characterProfile.appearance
            );
            
            await interaction.editReply({ embeds: [embed], components: [row] });
            
        } catch (error) {
            console.error(error);
            await interaction.editReply('There was an error processing your roleplay request.');
        }
    }
};