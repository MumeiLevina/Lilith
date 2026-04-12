# Lilith Discord Bot

Bot Discord với khả năng roleplay sử dụng OpenAI API.

## Cấu trúc dự án

```
lilith/
├── command/          # Slash commands
│   ├── roleplay.js   # Lệnh roleplay
│   ├── help.js       # Lệnh help
│   └── setting.js    # Lệnh settings
├── event/            # Discord events
│   ├── ready.js      # Sự kiện bot sẵn sàng
│   ├── interactioncreate.js  # Xử lý interactions
│   └── messagecreate.js      # Xử lý messages
├── models/           # MongoDB schemas
│   ├── user.js       # User model
│   └── conversation.js  # Conversation model
├── utils/            # Utility functions
│   ├── openaihandler.js  # OpenAI API handler
│   ├── embeds.js     # Discord embeds
│   └── config.js     # Bot configuration
├── handlers/         # Command/event loaders (có thể mở rộng)
├── index.js          # Main entry point
├── deploy-commands.js  # Deploy slash commands
├── package.json
├── .env              # Environment variables (không commit)
├── .env.example      # Template cho .env
└── .gitignore
```

## Cài đặt

1. Clone repository:
```bash
git clone <repository-url>
cd lilith
```

2. Cài đặt dependencies:
```bash
npm install
```

3. Tạo file `.env` từ template:
```bash
cp .env.example .env
```

4. Điền thông tin vào file `.env`:
- `DISCORD_TOKEN`: Token bot từ Discord Developer Portal
- `DISCORD_CLIENT_ID`: Client ID của bot
- `MONGODB_URI`: Connection string MongoDB
- `OPENAI_API_KEY`: API key từ OpenAI

## Sử dụng

1. Deploy slash commands lên Discord:
```bash
npm run deploy-commands
```

2. Khởi động bot:
```bash
npm start
```

3. Chạy ở chế độ development (auto-restart):
```bash
npm run dev
```

## Commands

- `/roleplay [message]` - Bắt đầu hoặc tiếp tục roleplay
- `/settings view` - Xem cài đặt hiện tại
- `/settings create_character` - Tạo nhân vật mới
- `/settings change_character` - Đổi nhân vật mặc định
- `/settings delete_character` - Xóa nhân vật
- `/settings language` - Đổi ngôn ngữ
- `/settings personality` - Tùy chỉnh tính cách bot
- `/play [query]` - Phát nhạc từ link hoặc từ khóa tìm kiếm
- `/skip` - Bỏ qua bài hát đang phát
- `/stop` - Dừng phát nhạc và xóa hàng đợi
- `/help` - Hiển thị trợ giúp

## Phát triển tương lai

Cấu trúc dự án đã được tối ưu để dễ dàng mở rộng:

1. **Thêm commands mới**: Tạo file mới trong `command/`
2. **Thêm events**: Tạo file mới trong `event/`
3. **Thêm models**: Tạo schema mới trong `models/`
4. **Thêm utilities**: Tạo helper functions trong `utils/`
5. **Handlers nâng cao**: Sử dụng `handlers/` cho logic phức tạp

## License

MIT
