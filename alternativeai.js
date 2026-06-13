const predefinedResponses = [
    "Xin chào! Tôi rất vui được trò chuyện với bạn. Bạn có khỏe không?",
    "Thật thú vị khi được nói chuyện với bạn! Bạn đang làm gì vậy?",
    "Tôi đang học hỏi mỗi ngày. Bạn thích làm gì trong thời gian rảnh?",
    "Tôi thích âm nhạc và nghệ thuật. Bạn có sở thích gì không?",
    "Hôm nay thời tiết thật đẹp, phải không? Bạn thích mùa nào nhất?",
    "Bạn đã ăn gì ngon hôm nay chưa? Tôi luôn tò mò về ẩm thực.",
    "Bạn có thích chơi game không? Tôi thấy nhiều người rất thích điều đó!",
    "Tôi đang cố gắng học thêm nhiều thứ mới. Bạn có thể chia sẻ điều gì đó thú vị không?",
    "Nếu bạn có thể đi du lịch đến bất kỳ đâu, bạn sẽ chọn nơi nào?",
    "Tôi thích đọc sách. Bạn có cuốn sách yêu thích nào không?"
];

function getAlternativeResponse(characterName, userMessage = '') {
    if (userMessage.toLowerCase().includes('xin chào') || 
        userMessage.toLowerCase().includes('chào') || 
        userMessage.toLowerCase().includes('hello') || 
        userMessage.toLowerCase().includes('hi')) {
        return `Xin chào! Tôi là ${characterName}. Rất vui được gặp bạn! Tôi có thể giúp gì cho bạn hôm nay?`;
    }
    
    if (userMessage.includes('?')) {
        return `Hmm, đó là một câu hỏi thú vị! Tôi nghĩ là... À, xin lỗi, tôi đang gặp vấn đề kết nối với dịch vụ AI. Tôi sẽ trả lời bạn sau khi kết nối lại nhé!`;
    }
    
    const randomIndex = Math.floor(Math.random() * predefinedResponses.length);
    return predefinedResponses[randomIndex];
}

module.exports = { getAlternativeResponse };
