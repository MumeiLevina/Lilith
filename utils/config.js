module.exports = {
    embedColor: '#FF9DD1',
    defaultCharacterName: 'Lilith',
    defaultPersonality: 'A kind and helpful AI assistant with a cheerful personality.',
    defaultAppearance: 'Has long silver hair and bright blue eyes.',
    maxConversationLength: 20,  // Giảm xuống để tránh vượt token limit
    openAIModel: 'gpt-4o-mini',
    
    clientId: process.env.CLIENT_ID
};