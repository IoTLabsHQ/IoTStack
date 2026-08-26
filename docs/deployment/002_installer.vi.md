# Cài Đặt Bằng Một Lệnh

Cài IoTStack lên server Linux mới (Ubuntu/Debian) chỉ với một lệnh, chạy
trực tiếp trên server:

```bash
curl -fsSL https://raw.githubusercontent.com/quan-vu/IoTStack/main/install.sh | sh
```

Lệnh này tự cài Docker nếu chưa có, tải IoTStack về, và khởi động stack.
Sau khi chạy xong, mở `http://<ip-server-của-bạn>`.

## Chạy lại trên bản đã cài sẵn

Script này an toàn khi chạy lại trên server đã có IoTStack — nó tự phát
hiện bản cài sẵn và hỏi trước khi đụng vào bất cứ thứ gì.

**Xác nhận cài lại.** Nếu phát hiện bản cài sẵn, script hỏi có muốn cài
lại hoàn toàn sạch không. Chọn không sẽ giữ nguyên mọi thứ. Chọn có:

- Backup `.env` (thứ duy nhất được tính là "cấu hình" trong dự án này)
  vào một thư mục có timestamp trên server.
- **Không backup dữ liệu thiết bị/tin nhắn** — cài lại sạch luôn xóa
  phần này. Nếu instance đang có thiết bị thật, script sẽ cảnh báo trước
  khi hỏi xác nhận.

**Domain & SSL.** Nếu phát hiện domain đã có chứng chỉ SSL, script hỏi
giữ domain đó (giữ luôn chứng chỉ) hay đổi sang domain khác. Giữ domain
giúp bạn khỏi phải chờ cấp chứng chỉ mới.

## Cái gì bị xóa, cái gì được giữ khi cài lại

| Dữ liệu | Cài lại sạch | Cài lại, giữ domain |
|---|---|---|
| Thiết bị, tin nhắn, cài đặt dashboard | Xóa | Xóa |
| Domain & chứng chỉ SSL | Xóa (hỏi domain mới) | Giữ |

Dữ liệu thiết bị/tin nhắn không bao giờ được giữ lại khi cài lại, dù theo
hướng nào — chỉ domain và chứng chỉ của nó mới có thể được giữ.

## Dùng không tương tác

Cho các lần cài tự động (script hóa), bỏ qua các câu hỏi bằng biến môi
trường:

```bash
IOTSTACK_REINSTALL=fresh IOTSTACK_DOMAIN_CHOICE=keep \
  curl -fsSL https://raw.githubusercontent.com/quan-vu/IoTStack/main/install.sh | sh
```

- `IOTSTACK_REINSTALL=fresh` hoặc `keep` — bỏ qua câu hỏi cài lại.
- `IOTSTACK_DOMAIN_CHOICE=keep` hoặc `new` — bỏ qua câu hỏi domain.
- `DOMAIN=your-domain.com` / `ADMIN_EMAIL=you@example.com` — set trực
  tiếp thay vì bị hỏi.

## Cách khác: triển khai từ máy tính của bạn

Muốn deploy từ máy tính của bạn qua SSH thay vì chạy lệnh trực tiếp trên
server? Xem [Cài đặt VPS thủ công](003_manual-vps-setup.vi.md).
