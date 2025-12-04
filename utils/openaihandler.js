const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Giới hạn số tin nhắn để tránh vượt quá context length
const MAX_MESSAGES = 20; // Chỉ lấy 20 tin nhắn gần nhất

async function handleOpenAIRequest(messages, characterProfile) {
    try {
        const systemMessage = {
            role: 'system',
            content: `You are roleplaying as ${characterProfile.name}. 
Personality: ${characterProfile.personality}
Appearance: ${characterProfile.appearance}

Stay in character at all times. Respond naturally and maintain the character's personality traits in your responses.`
        };

        // Giới hạn số lượng tin nhắn để tránh vượt quá token limit
        // Lấy các tin nhắn gần nhất
        const limitedMessages = messages.slice(-MAX_MESSAGES);

        const completion = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
            messages: [systemMessage, ...limitedMessages],
            max_tokens: parseInt(process.env.MAX_TOKENS) || 500,
            temperature: parseFloat(process.env.TEMPERATURE) || 0.8
        });

        return completion.choices[0].message.content;
    } catch (error) {
        console.error('OpenAI API Error:', error);
        throw new Error('Failed to get response from OpenAI');
    }
}

module.exports = { handleOpenAIRequest };
