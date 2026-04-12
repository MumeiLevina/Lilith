const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('./config');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const MAX_MESSAGES = 20;
const DEFAULT_PRIMARY_MODEL = 'gemini-2.5-flash';
const DEFAULT_BACKUP_MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash'];

function getGeminiModelCandidates() {
    const primaryModel = (process.env.GEMINI_MODEL || DEFAULT_PRIMARY_MODEL).trim();
    const envBackupModels = (process.env.GEMINI_BACKUP_MODELS || '')
        .split(',')
        .map(model => model.trim())
        .filter(Boolean);

    const merged = [primaryModel, ...envBackupModels, ...DEFAULT_BACKUP_MODELS].filter(Boolean);
    return [...new Set(merged)];
}

function shouldTryNextModel(error) {
    const statusCode = Number(error?.status || error?.statusCode || error?.cause?.status || 0);
    if (statusCode === 401) return false;

    const message = (error?.message || '').toLowerCase();
    if (!message) return true;

    const authErrors = [
        'api key not valid',
        'invalid api key',
        'api_key_invalid',
        'permission denied'
    ];

    if (authErrors.some(fragment => message.includes(fragment))) {
        return false;
    }

    return true;
}

async function generateWithModel({
    modelName,
    systemContent,
    maxTokens,
    temperature,
    geminiHistory,
    latestMessage
}) {
    const model = genAI.getGenerativeModel(
        {
            model: modelName,
            systemInstruction: systemContent
        },
        {
            generationConfig: {
                maxOutputTokens: maxTokens,
                temperature
            }
        }
    );

    const chatSession = model.startChat({
        history: geminiHistory
    });

    const result = await chatSession.sendMessage(latestMessage.content);
    return result.response.text();
}

async function handleGeminiRequest(messages, characterProfile, userPreferences = {}, botDisplayName = null) {
    try {
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
        const temperature = parseFloat(process.env.TEMPERATURE) || 0.7;

        // Convert messages (role: 'user'/'assistant' -> 'user'/'model')
        const limitedMessages = messages.slice(-MAX_MESSAGES);
        const geminiHistory = limitedMessages.slice(0, -1).map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));
        
        const latestMessage = limitedMessages[limitedMessages.length - 1];
        const modelCandidates = getGeminiModelCandidates();

        let lastError = null;
        for (let index = 0; index < modelCandidates.length; index++) {
            const modelName = modelCandidates[index];

            try {
                const response = await generateWithModel({
                    modelName,
                    systemContent,
                    maxTokens,
                    temperature,
                    geminiHistory,
                    latestMessage
                });

                if (index > 0) {
                    console.warn(`[Gemini] Primary model failed previously. Switched to backup model: ${modelName}`);
                }

                return response;
            } catch (modelError) {
                lastError = modelError;
                console.warn(`[Gemini] Model failed: ${modelName}.`, modelError?.message || modelError);

                if (!shouldTryNextModel(modelError)) {
                    break;
                }
            }
        }

        throw lastError || new Error('All Gemini models failed');
    } catch (error) {
        console.error('Gemini API Error:', error);
        throw new Error('Failed to get response from Gemini');
    }
}

module.exports = { handleGeminiRequest };