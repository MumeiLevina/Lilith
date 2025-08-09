const { handleOpenAIRequest } = require('../util/openaihandler');
const User = require('../model/user');
const Conversation = require('../model/conversation');
const { createRoleplayEmbed } = require('../util/embeds');

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        if (message.author.bot) return;
        
        if (!message.mentions.has(message.client.user.id)) return;
        
        const content = message.content.replace(/<@!?(\d+)>/g, '').trim();
        
        if (!content) return;
        
        try {
            const user = await User.findOneAndUpdate(
                { userId: message.author.id },
                { userId: message.author.id },
                { upsert: true, new: true }
            );
            
            let conversation = await Conversation.findOne({
                userId: message.author.id,
                isActive: true
            });
            
            if (!conversation) {
                conversation = new Conversation({
                    userId: message.author.id,
                    characterName: user.defaultCharacterName || 'Lilith',
                    messages: []
                });
            }
            
            conversation.messages.push({
                role: 'user',
                content: content
            });
            
            const characterProfile = user.characterProfiles.find(
                profile => profile.name === conversation.characterName
            ) || {
                name: 'Lilith',
                personality: 'A kind and helpful AI assistant with a cheerful personality.',
                appearance: 'Has long silver hair and bright blue eyes.'
            };
            
            message.channel.sendTyping();
            
            const userPreferences = {
                preferredLanguage: user.preferredLanguage || 'Vietnamese',
                customBotPersonality: user.customBotPersonality || ''
            };
            
            const aiResponse = await handleOpenAIRequest(conversation.messages, characterProfile, userPreferences);
            
            conversation.messages.push({
                role: 'assistant',
                content: aiResponse
            });
            
            await conversation.save();
            
            const embed = createRoleplayEmbed(
                conversation.characterName,
                aiResponse,
                characterProfile.appearance
            );
            
            await message.reply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error in messageCreate event:', error);
            await message.reply('Sorry, I encountered an error while processing your message.');
        }
    }
};