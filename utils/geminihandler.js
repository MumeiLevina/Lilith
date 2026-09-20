// Forward to OpenAI handler (switched from Gemini to OpenAI gpt-4o-mini)
const { handleOpenAIRequest, handleGeminiRequest } = require('./openaihandler');

module.exports = {
    handleGeminiRequest,
    handleOpenAIRequest
};