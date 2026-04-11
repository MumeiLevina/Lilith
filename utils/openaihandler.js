const OpenAI = require('openai');
const config = require('./config');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Giới hạn số tin nhắn để tránh vượt quá context length
const MAX_MESSAGES = 20; // Chỉ lấy 20 tin nhắn gần nhất

async function handleOpenAIRequest(messages, characterProfile, userPreferences = {}, botDisplayName = null) {
    try {
        // Tạo danh sách tên gọi khác nhau của bot
        const names = [characterProfile.name];
        if (botDisplayName && botDisplayName !== characterProfile.name) {
            names.push(botDisplayName);
        }
        
        // Thêm các biến thể tên ngắn (nickname, rút gọn)
        const allPossibleNames = [...names];
        names.forEach(name => {
            // Lấy từ đầu tiên (Ali từ "Lilith Ali")
            const firstWord = name.split(' ')[0];
            if (firstWord && !allPossibleNames.includes(firstWord)) {
                allPossibleNames.push(firstWord);
            }
            // Lấy từ cuối cùng (Ali từ "Lilith Ali")
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
        
        // Lấy hướng dẫn phong cách viết dựa trên cài đặt người dùng
        const styleInstruction = config.getStyleInstruction(userPreferences.responseStyle || {});
        
        // Sử dụng prompt core từ config nếu character là Lilith
        let systemContent;
        if (characterProfile.name === config.defaultCharacterName || characterProfile.name === 'Lilith') {
            systemContent = `${config.promptCore}

${namesList}
Ngoại hình: ${characterProfile.appearance || config.appearance.defaultAppearance}
${languagePreference}
${personalityOverride}
${styleInstruction}

QUAN TRỌNG: Khi ai đó nhắc đến bất kỳ tên nào của bạn (${allPossibleNames.join(', ')}), hãy thừa nhận rằng họ đang nói chuyện với bạn và phản hồi một cách tự nhiên theo nhân vật. Luôn giữ vai và duy trì các đặc điểm tính cách của bạn trong phản hồi.`;
        } else {
            // Fallback cho các nhân vật khác
            systemContent = `Bạn đang nhập vai một nhân vật. ${namesList}
Tính cách: ${characterProfile.personality}
Ngoại hình: ${characterProfile.appearance}
${languagePreference}
${personalityOverride}
${styleInstruction}

QUAN TRỌNG: Khi ai đó nhắc đến bất kỳ tên nào của bạn (${allPossibleNames.join(', ')}), hãy thừa nhận rằng họ đang nói chuyện với bạn và phản hồi một cách tự nhiên theo nhân vật. Luôn giữ vai và duy trì các đặc điểm tính cách của bạn trong phản hồi.`;
        }
        
        const systemMessage = {
            role: 'system',
            content: systemContent
        };

        // Giới hạn số lượng tin nhắn để tránh vượt quá token limit
        // Lấy các tin nhắn gần nhất
        const limitedMessages = messages.slice(-MAX_MESSAGES);

        // Xác định max_tokens dựa trên responseStyle
        const responseLength = userPreferences.responseStyle?.length || 'poetic';
        const stylePreset = config.responseStylePresets[responseLength] || config.responseStylePresets.poetic;
        const maxTokens = stylePreset.maxTokens || parseInt(process.env.MAX_TOKENS) || 3000;

        const completion = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
            messages: [systemMessage, ...limitedMessages],
            max_tokens: maxTokens,
            temperature: parseFloat(process.env.TEMPERATURE) || 0.7
        });

        return completion.choices[0].message.content;
    } catch (error) {
        console.error('OpenAI API Error:', error);
        throw new Error('Failed to get response from OpenAI');
    }
}

module.exports = { handleOpenAIRequest };
