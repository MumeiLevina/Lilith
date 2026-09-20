const OpenAI = require('openai');
const config = require('./config');

const DEFAULT_MODEL = 'gpt-4o-mini';
const MAX_MESSAGES = 20;

function getOpenAIClient() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not set in environment variables.');
    }
    return new OpenAI({ apiKey });
}

async function handleOpenAIRequest(messages, characterProfile, userPreferences = {}, botDisplayName = null) {
    try {
        const openai = getOpenAIClient();

        const names = [characterProfile.name];
        if (botDisplayName && botDisplayName !== characterProfile.name) {
            names.push(botDisplayName);
        }
        
        const allPossibleNames = [...names];
        names.forEach(name => {
            const firstWord = name.split(' ')[0];
            if (firstWord && !allPossibleNames.includes(firstWord)) {
                allPossibleNames.push(firstWord);
            }
            const lastWord = name.split(' ').pop();
            if (lastWord && lastWord !== firstWord && !allPossibleNames.includes(lastWord)) {
                allPossibleNames.push(lastWord);
            }
        });
        
        const namesList = allPossibleNames.length > 1 
            ? `Tên của bạn là ${characterProfile.name}. Bạn cũng có thể được gọi là: ${allPossibleNames.slice(1).join(', ')}. Nhận biết và phản hồi khi được gọi bằng bất kỳ tên nào trong số này.`
            : `Tên của bạn là ${characterProfile.name}.`;
        
        const languagePreference = userPreferences.preferredLanguage 
            ? `Ngôn ngữ ưa thích: ${userPreferences.preferredLanguage}.` 
            : '';
        
        const personalityOverride = userPreferences.customBotPersonality 
            ? `Đặc điểm tính cách bổ sung: ${userPreferences.customBotPersonality}.` 
            : '';
        
        const styleInstruction = config.getStyleInstruction(userPreferences.responseStyle || {});
        
        let systemContent;
        if (characterProfile.name === config.defaultCharacterName || characterProfile.name === 'Lilith') {
            systemContent = `${config.promptCore}\n\n${namesList}\nNgoại hình: ${characterProfile.appearance || config.appearance.defaultAppearance}\n${languagePreference}\n${personalityOverride}\n${styleInstruction}\n\nQUAN TRỌNG: Khi ai đó nhắc đến bất kỳ tên nào của bạn (${allPossibleNames.join(', ')}), hãy thừa nhận rằng họ đang nói chuyện với bạn và phản hồi một cách tự nhiên theo nhân vật. Luôn giữ vai và duy trì các đặc điểm tính cách của bạn trong phản hồi.`;
        } else {
            systemContent = `Bạn đang nhập vai một nhân vật. ${namesList}\nTính cách: ${characterProfile.personality}\nNgoại hình: ${characterProfile.appearance}\n${languagePreference}\n${personalityOverride}\n${styleInstruction}\n\nQUAN TRỌNG: Khi ai đó nhắc đến bất kỳ tên nào của bạn (${allPossibleNames.join(', ')}), hãy thừa nhận rằng họ đang nói chuyện với bạn và phản hồi một cách tự nhiên theo nhân vật. Luôn giữ vai và duy trì các đặc điểm tính cách của bạn trong phản hồi.`;
        }

        const responseLength = userPreferences.responseStyle?.length || 'poetic';
        const stylePreset = config.responseStylePresets[responseLength] || config.responseStylePresets.poetic;
        const maxTokens = stylePreset.maxTokens || parseInt(process.env.MAX_TOKENS) || 3000;
        const temperature = parseFloat(process.env.TEMPERATURE) || 0.8;
        const model = (process.env.OPENAI_MODEL || DEFAULT_MODEL).trim();

        // Convert messages (role: 'user'/'assistant' / 'model' -> OpenAI format)
        const limitedMessages = (messages || []).slice(-MAX_MESSAGES);
        const chatMessages = [
            { role: 'system', content: systemContent },
            ...limitedMessages.map(msg => ({
                role: msg.role === 'model' ? 'assistant' : msg.role,
                content: msg.content
            }))
        ];

        const completion = await openai.chat.completions.create({
            model,
            messages: chatMessages,
            max_tokens: maxTokens,
            temperature
        });

        return completion.choices[0]?.message?.content || '';
    } catch (error) {
        console.error('OpenAI API Error:', error);
        throw new Error('Failed to get response from OpenAI: ' + (error?.message || error));
    }
}

module.exports = { 
    handleOpenAIRequest,
    handleGeminiRequest: handleOpenAIRequest // Backward compatibility alias
};
