# Cài Đặt VPS Thủ Công

Cách thay thế cho [trình cài đặt một lệnh](002_installer.vi.md): triển
khai từ máy tính của bạn qua SSH, dùng bản checkout của repo này.

## Deploy tự động (khuyến nghị)

Từ máy tính của bạn — không phải trên server — với repo này đã checkout
và SSH key đã được authorize trên máy đích:

```bash
deploy/bootstrap.sh root@your-server-ip
```

Một lệnh duy nhất làm tất cả: tạo user quản trị non-root với SSH-key-only
access (bỏ qua nếu đã có), cài Docker Engine + Compose plugin (bỏ qua nếu
đã cài), copy bản checkout này lên server, tạo `.env` với secret ngẫu
nhiên thật ở lần deploy đầu tiên, và khởi động stack — sau đó đợi API báo
healthy mới thoát.

VPS bạn đã có sẵn user quản trị cũng dùng y hệt, chỉ cần target đúng user
đó thay vì `root`:

```bash
deploy/bootstrap.sh iotstack@your-server-ip
```

Flag tùy chọn: `--domain example.com` (để có chứng chỉ Let's Encrypt thật
thay vì self-signed cho `localhost`) và `--admin-email you@example.com`
(bỏ qua câu hỏi tương tác). Nếu chỉ truyền `--admin-email` mà không có
password, một password sẽ được tạo ngẫu nhiên và in ra một lần duy nhất
ở cuối — lưu lại ngay.

Chạy lại `bootstrap.sh` trên server đã deploy rồi vẫn an toàn: nó bỏ qua
các bước đã xong và cập nhật code đang chạy mà không đụng vào `.env` hiện
có.

## Deploy thủ công

Các bước mà `bootstrap.sh` tự động hóa, để tham khảo hoặc nếu bạn muốn tự
làm tay.

### Truy cập server lần đầu

Đừng vận hành server hằng ngày bằng `root`. Tạo một user quản trị riêng
non-root, chỉ dùng SSH key, với `sudo` không cần password:

- [Tạo user quản trị VPS](004_vps-admin-user.vi.md) — hướng dẫn đầy đủ,
  gồm cả tạo SSH key riêng cho server và alias trong `~/.ssh/config`.
- [`setup-vps-user.sh`](../setup-vps-user.sh) — script được hướng dẫn đó
  tham chiếu tới.

### Deploy

Sau khi đã có user quản trị và cài Docker xong, copy bản checkout này lên
server (`rsync`, `scp`, hoặc cách bạn muốn — repo không cần phải public),
rồi trên server:

```bash
cd iotstack
cp .env.example .env
# chỉnh .env — xem phần Cấu hình trong README chính
docker compose up -d --build
```

Xem [README](../../README.md) chính để biết đầy đủ quick-start và các
bước sau deploy (tạo thiết bị đầu tiên, kết nối firmware).
