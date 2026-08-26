# Yêu Cầu Server

## Cấu hình tối thiểu

| Tài nguyên | Tối thiểu | Ghi chú |
|---|---|---|
| CPU | 1 vCPU | 2 vCPU sẽ dư dả hơn cho vài chục thiết bị |
| RAM | 2 GB | Xem [Kiến trúc](../reference/001_architecture.vi.md#dung-lượng-tài-nguyên) để biết chi tiết từng service (~150-300 MB khi idle) |
| Disk | 20-40 GB | Chủ yếu là OS + Docker image; dung lượng lưu tin nhắn bị giới hạn bởi `STORAGE_CAP_MB` mỗi thiết bị, nên tổng dung lượng phụ thuộc số thiết bị × giới hạn đó, không phụ thuộc lượng traffic |
| OS | Ubuntu 22.04/24.04 LTS | Hướng dẫn tạo user quản trị giả định có `apt`/`systemctl`/`sshd_config.d` |

VPS 2 vCPU / 2 GB RAM / 40 GB disk (ví dụ một droplet/box nhỏ từ bất kỳ
nhà cung cấp phổ biến nào) chạy stack này thoải mái cho nhu cầu cá nhân
hoặc một nhóm nhỏ.

## Yêu cầu trên server

- **Docker Engine + Docker Compose plugin** (`docker compose`, không phải
  bản `docker-compose` v1 độc lập). Cài qua script tiện lợi chính thức
  hoặc repo của distro — xem
  [docs.docker.com/engine/install](https://docs.docker.com/engine/install/).
  [Trình cài đặt một lệnh](002_installer.vi.md) tự làm việc này giúp bạn.
- **Bản ghi DNS A** trỏ domain về IP server, nếu muốn có HTTPS tự động.
  Không bắt buộc nếu chỉ dùng HTTP thường — bạn có thể thêm domain bất
  cứ lúc nào sau đó từ trang Settings của dashboard.
- **Mở các port inbound**: `22` (SSH), `80`/`443` (dashboard, HTTP→HTTPS),
  `1883`/`8883`/`9001` (MQTT thường/TLS/WebSocket).
