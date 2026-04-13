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
- `DISCORD_CLIENT_SECRET`: Client secret cho OAuth2 dashboard
- `DISCORD_OAUTH_REDIRECT_URI`: Callback URL OAuth2 (ví dụ `http://localhost:3000/auth/discord/callback`)
- `SESSION_SECRET`: Secret để ký session cookie cho dashboard
- `WEB_PORT`: Port web dashboard (mặc định `3000`)
- `WEB_ORIGIN`: Origin frontend cho CORS (tuỳ chọn)

## Sử dụng

1. Deploy slash commands lên Discord:
```bash
npm run deploy-commands
```

2. Khởi động bot:
```bash
npm start
```

Sau khi bot chạy, truy cập dashboard tại:
`http://localhost:3000/dashboard`

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
- `/queue` - Xem danh sách hàng đợi
- `/nowplaying` - Xem bài hát đang phát và tiến trình
- `/skip` - Bỏ qua bài hát đang phát
- `/pause` - Tạm dừng bài hát hiện tại (DJ)
- `/resume` - Tiếp tục phát nhạc (DJ)
- `/stop` - Dừng phát nhạc và xóa hàng đợi
- `/loop [mode]` - Chế độ lặp: off/track/queue (DJ)
- `/autoplay [state]` - Bật/tắt autoplay (DJ)
- `/help` - Hiển thị trợ giúp

### DJ Role cho lệnh điều khiển nhạc

- Mặc định role yêu cầu là `DJ`.
- Có thể cấu hình qua env:
  - `DJ_ROLE_NAME=DJ`
  - `DJ_ROLE_ID=<discord_role_id>`
- Thành viên có quyền `Administrator` hoặc `ManageGuild` có thể dùng lệnh DJ mà không cần role.

## Web Dashboard (MVP)

- Đăng nhập bằng Discord OAuth2 (`/auth/discord`)
- API điều khiển nhạc:
  - `POST /api/music/play`
  - `POST /api/music/pause`
  - `POST /api/music/resume`
  - `POST /api/music/skip`
  - `POST /api/music/stop`
  - `GET /api/music/queue`
  - `GET /api/music/now-playing`
  - `POST /api/music/seek`
  - `POST /api/music/volume`
- Yêu cầu bảo mật:
  - Phải đăng nhập Discord
  - Phải vào cùng voice channel với bot
  - Các lệnh điều khiển quan trọng yêu cầu quyền DJ/Admin
  - Có CSRF token và rate limiting cơ bản
- Realtime:
  - Socket.IO đẩy trạng thái track, queue, progress lên dashboard

## Phát triển tương lai

Cấu trúc dự án đã được tối ưu để dễ dàng mở rộng:

1. **Thêm commands mới**: Tạo file mới trong `command/`
2. **Thêm events**: Tạo file mới trong `event/`
3. **Thêm models**: Tạo schema mới trong `models/`
4. **Thêm utilities**: Tạo helper functions trong `utils/`
5. **Handlers nâng cao**: Sử dụng `handlers/` cho logic phức tạp

## License

MIT
