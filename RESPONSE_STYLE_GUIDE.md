# Hướng Dẫn Sử Dụng Tính Năng Phong Cách Phản Hồi

## Tổng Quan

Bot Lilith giờ đây có khả năng **nhớ và áp dụng cài đặt cá nhân** của từng người dùng, bao gồm phong cách viết dài, văn thơ được lưu trong MongoDB.

## Các Tính Năng Mới

### 1. **Lưu Trữ Cài Đặt Cá Nhân**
- Mỗi người dùng có cài đặt riêng được lưu trong database
- Cài đặt được tự động áp dụng mỗi khi trò chuyện
- Không cần thiết lập lại sau mỗi lần chat

### 2. **Phong Cách Phản Hồi (Response Style)**
Người dùng có thể tùy chỉnh:

#### **Độ Dài (Length)**
- `short`: Ngắn gọn (1-2 đoạn văn)
- `medium`: Trung bình (2-3 đoạn văn)
- `long`: Dài (4-6 đoạn văn)
- `poetic`: **Thơ mộng** (5-8 đoạn văn, CỰC KỲ dài, văn chương cao)

#### **Mức Độ Thơ Mộng (Poetic Level)**
- **1/5**: Bình thường, ít ẩn dụ
- **2/5**: Nhẹ nhàng, vài ẩn dụ
- **3/5**: Trung bình, nhiều hình ảnh
- **4/5**: Cao, nhiều ẩn dụ văn chương
- **5/5**: **Tối đa, CỰC KỲ thơ mộng, ngôn ngữ văn chương cao**

#### **Mức Độ Chi Tiết (Detail Level)**
- **1/5**: Tối giản, chỉ ý chính
- **2/5**: Cơ bản, ít chi tiết
- **3/5**: Đầy đủ, chi tiết vừa phải
- **4/5**: Sâu sắc, rất chi tiết
- **5/5**: **Tối đa, CỰC KỲ chi tiết, mỗi ý đều được mở rộng**

## Cách Sử Dụng

### Bước 1: Thiết Lập Phong Cách
```
/settings response_style
```

Bot sẽ hiển thị menu cho bạn chọn:
1. **Độ dài phản hồi** - Chọn từ ngắn đến thơ mộng
2. **Mức độ thơ mộng** - Chọn từ 1-5 sao
3. **Mức độ chi tiết** - Chọn từ 1-5 sao

### Bước 2: Xem Cài Đặt Hiện Tại
```
/settings view
```

Kiểm tra tất cả cài đặt của bạn, bao gồm phong cách phản hồi.

### Bước 3: Chat Như Bình Thường
Chỉ cần tag bot hoặc dùng lệnh `/roleplay` - bot sẽ tự động áp dụng phong cách bạn đã chọn!

## Cài Đặt Mặc Định

Mặc định, bot sử dụng phong cách **Poetic** (Thơ mộng) với:
- Độ dài: **Poetic** (5-8 đoạn văn)
- Mức độ thơ mộng: **5/5** (Tối đa)
- Mức độ chi tiết: **5/5** (Tối đa)
- Sử dụng ẩn dụ: **CÓ**
- Số đoạn văn: **5 đoạn**

Cài đặt này phù hợp với tính cách Lilith - một thực thể văn thơ, mơ hồ, đầy cảm xúc.

## Ví Dụ Sử Dụng

### Ví Dụ 1: Người Dùng Thích Câu Trả Lời Ngắn
```
/settings response_style
→ Chọn "Ngắn gọn"
→ Chọn mức thơ mộng: 2/5
→ Chọn mức chi tiết: 2/5
```
**Kết quả**: Bot sẽ trả lời ngắn gọn, ít ẩn dụ, đi thẳng vào vấn đề.

### Ví Dụ 2: Người Dùng Yêu Thích Văn Thơ Sâu Sắc (Mặc định)
```
/settings response_style
→ Chọn "Thơ mộng (Poetic)"
→ Chọn mức thơ mộng: 5/5
→ Chọn mức chi tiết: 5/5
```
**Kết quả**: Bot sẽ viết cực kỳ dài, đầy ẩn dụ, hình ảnh thơ mộng, triển khai từng cảm xúc một cách sâu sắc như một bài thơ dài hoặc đoạn văn trong tiểu thuyết.

## Thay Đổi Kỹ Thuật

### Database Schema (models/user.js)
```javascript
responseStyle: {
    length: { type: String, enum: ['short', 'medium', 'long', 'poetic'], default: 'poetic' },
    poeticLevel: { type: Number, min: 1, max: 5, default: 5 },
    detailLevel: { type: Number, min: 1, max: 5, default: 5 },
    metaphorUsage: { type: Boolean, default: true },
    paragraphCount: { type: Number, min: 1, max: 10, default: 5 }
}
```

### Config (utils/config.js)
- Thêm `responseStylePresets` với 4 mức độ (short, medium, long, poetic)
- Thêm hàm `getStyleInstruction()` để tạo hướng dẫn động cho AI
- Mỗi preset có `maxTokens` riêng (500 - 3000 tokens)

### OpenAI Handler (utils/openaihandler.js)
- Tự động đọc `responseStyle` từ user preferences
- Áp dụng hướng dẫn phong cách vào system message
- Điều chỉnh `max_tokens` dựa trên độ dài được chọn

### Event Handlers (event/messagecreate.js, event/interactioncreate.js)
- Truyền `responseStyle` vào `userPreferences`
- Thêm handlers cho 3 select menu mới:
  - `select_response_length`
  - `select_poetic_level`
  - `select_detail_level`

## Lợi Ích

✅ **Cá nhân hóa cao**: Mỗi người dùng có trải nghiệm riêng  
✅ **Lưu trữ lâu dài**: Cài đặt được lưu trong MongoDB, không mất khi restart  
✅ **Linh hoạt**: Thay đổi phong cách bất cứ lúc nào  
✅ **Tự động áp dụng**: Không cần thiết lập lại mỗi lần chat  
✅ **Phù hợp character**: Phong cách mặc định phản ánh đúng tính cách Lilith

## Lưu Ý Quan Trọng

⚠️ **Chi phí API**: Phong cách "Poetic" với mức 5/5 sử dụng nhiều tokens hơn (max 3000 tokens), có thể tốn phí OpenAI cao hơn.

⚠️ **Thời gian phản hồi**: Câu trả lời dài hơn = thời gian xử lý lâu hơn.

💡 **Khuyến nghị**: Nếu muốn tiết kiệm chi phí, sử dụng phong cách "Trung bình" hoặc "Ngắn gọn".

## Tương Lai

Các tính năng có thể thêm sau:
- Preset phong cách nhanh (Romantic, Philosophical, Mysterious, etc.)
- Thay đổi phong cách theo ngữ cảnh (buồn = thơ mộng hơn)
- Lịch sử phong cách đã sử dụng
- A/B testing để tìm phong cách phù hợp nhất

---

**Tạo bởi**: Lilith Bot Team  
**Ngày**: 2026-01-01  
**Version**: 2.0.0 - Response Style Update
