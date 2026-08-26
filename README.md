# IoTStack

IoTStack là nền tảng IoT mã nguồn mở, self-hosted dành cho maker, học sinh, sinh viên, giáo viên và developer muốn tự vận hành hạ tầng IoT mà không phụ thuộc vào dịch vụ cloud được quản lý.

Nền tảng cung cấp một **IoT stack tối giản, nhẹ nhưng mạnh mẽ** với các tính năng tích hợp sẵn:

* **Mosquitto MQTT Broker nhẹ** để giao tiếp ổn định với thiết bị
* **Web Dashboard tích hợp sẵn** để quản lý kết nối MQTT, thông tin xác thực và thiết bị
* **Giám sát & Điều khiển thiết bị** để theo dõi trạng thái, xem dữ liệu và điều khiển thiết bị theo thời gian thực
* **Quản lý thiết bị đơn giản** để tạo và quản lý thông tin xác thực cho từng thiết bị
* **Tối ưu cho máy chủ nhỏ** — được thiết kế để chạy tốt trên server khoảng **2 vCPU và 2 GB RAM** cho nhu cầu Maker và phát triển

Toàn bộ những thành phần cần thiết cho một IoT backend thực tế được đóng gói trong một stack nhỏ gọn. Bạn có thể triển khai trên server của riêng mình, kết nối, giám sát và điều khiển thiết bị, đồng thời giữ toàn bộ hạ tầng IoT dưới quyền kiểm soát của bạn.

IoTStack hoạt động hoàn toàn độc lập, không yêu cầu tài khoản IoTLabs Cloud và được **IoTLabs Team** duy trì, cập nhật. Dữ liệu IoT của bạn luôn nằm trên server do chính bạn kiểm soát — không được gửi hoặc lưu trữ trên IoTLabs Cloud.


## Bạn nhận được gì

- **MQTT broker** (Mosquitto) — MQTT thường, MQTTS (TLS), và MQTT qua
  WebSocket, để cả firmware lẫn trình duyệt đều kết nối được.
- **Dashboard tích hợp** — tạo và quản lý thông tin xác thực thiết bị, xem
  tin nhắn đến theo thời gian thực, gửi lệnh, xem dung lượng lưu trữ từng
  thiết bị.
- **Cô lập theo từng thiết bị** — mỗi thiết bị có thông tin xác thực riêng,
  chỉ publish/subscribe được trong tiền tố topic của chính nó. Một thiết bị
  bị lộ thông tin xác thực không thể thấy hay đụng vào dữ liệu thiết bị
  khác.
- **Cấu hình mặc định hợp lý cho triển khai nhỏ** — giới hạn tốc độ gửi tin
  và dung lượng lưu trữ áp dụng cho mọi thiết bị (có thể chỉnh), tin nhắn cũ
  tự động hết hạn, toàn bộ stack được thiết kế chạy thoải mái trên VPS
  1-2 CPU / 2 GB RAM.
- **Chạy được ngay qua IP server** — HTTP thường, không cần domain hay TLS
  để bắt đầu.
- **Tự động HTTPS khi bạn cần** — thêm domain bất cứ lúc nào từ trang
  Settings của dashboard (đổi lại cũng được, không giới hạn), chứng chỉ
  thật được cấp ngay, không cần restart.

## Bắt đầu nhanh

```bash
git clone <this-repository> iotstack
cd iotstack
cp .env.example .env
# edit .env: set ADMIN_EMAIL, ADMIN_PASSWORD, and generate real secrets for
# SESSION_SECRET / DYNSEC_CONTROLLER_PASSWORD (see the comments in the file)
docker compose up -d --build
```

Mở `http://<your-server-ip>`, đăng nhập bằng tài khoản admin bạn đã cấu
hình, và tạo thiết bị đầu tiên. Thêm domain bất cứ lúc nào từ trang
Settings của dashboard để có `https://your-domain` với chứng chỉ thật —
không cần sửa `.env`, không cần restart. Dashboard hiển thị chính xác
host/port và thông tin xác thực để đưa vào firmware.

## Kết nối thiết bị

Mỗi thiết bị có:

- **Client ID** — cũng là tiền tố của mọi topic thiết bị được phép dùng:
  `devices/{client_id}/...`
- **Username và password** — hiển thị một lần duy nhất khi thiết bị được
  tạo (hoặc tạo lại). Nếu mất, tạo lại thông tin xác thực mới; thông tin cũ
  ngừng hoạt động ngay lập tức.

Ví dụ (MQTT thường, port 1883):

```
Host:     your-server-or-domain
Port:     1883 (plain), 8883 (TLS, once a domain is set from Settings), 9001 (WebSocket)
Username: <shown in dashboard>
Password: <shown in dashboard>
Publish:  devices/<client_id>/telemetry
Subscribe: devices/<client_id>/cmd
```

Các loại tin nhắn được collector nhận dạng: `ping`, `status`, `telemetry`,
`cmd` — tin nhắn gửi tới bất kỳ topic suffix nào khác sẽ bị loại bỏ.

## Cấu hình

Toàn bộ cấu hình là biến môi trường trong `.env` — xem `.env.example` để có
danh sách đầy đủ kèm chú thích. Các biến quan trọng:

| Variable | Điều khiển gì |
|---|---|
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Tài khoản đăng nhập dashboard, được khởi tạo một lần duy nhất khi chạy lần đầu |
| `DOMAIN` | Chỉ là tiện ích cho lần chạy đầu tiên — thiết lập domain ban đầu. Sau đó đổi domain bất cứ lúc nào từ trang Settings của dashboard; `.env` không bao giờ được đọc lại cho việc này. |
| `RATE_LIMIT_MSG_PER_MIN` | Số tin nhắn/phút cho phép mỗi thiết bị |
| `STORAGE_CAP_MB` | Dung lượng dữ liệu tin nhắn được lưu cho phép mỗi thiết bị |
| `RAW_RETENTION_DAYS` | Thời gian giữ tin nhắn trước khi tự động xoá |

## Kiến trúc và bảo mật

Xem [Kiến trúc](docs/reference/001_architecture.vi.md) để biết các thành
phần khớp với nhau ra sao, và [Bảo mật](docs/reference/002_security.vi.md)
để biết mô hình bảo mật và các giới hạn đã biết. Toàn bộ tài liệu cũng
xem được ngay trên dashboard, ở trang **Documentation**.

## Triển khai

Có VPS mới? Một lệnh duy nhất cài đặt toàn bộ stack, chạy ngay trên
server:

```bash
curl -fsSL https://raw.githubusercontent.com/IoTLabsHQ/IoTStack/main/install.sh | sh
```

Xem [Cài đặt bằng một lệnh](docs/deployment/002_installer.vi.md) để biết
chi tiết — cách xử lý khi cài lại, giữ domain/SSL, và các tuỳ chọn không
tương tác.

Muốn triển khai từ máy tính của bạn qua SSH thay vì chạy lệnh trực tiếp
trên server? Xem [Cài đặt VPS thủ công](docs/deployment/003_manual-vps-setup.vi.md).

## Tài nguyên sử dụng

Ba container, tổng RAM khi idle khoảng 150-300 MB: Mosquitto, một service
Node.js API/collector nhỏ, và Caddy làm cổng HTTPS. Chạy thoải mái trên VPS
1-2 CPU / 2 GB RAM cho vài chục thiết bị.

## Giấy phép

MIT — xem [`LICENSE`](LICENSE).

---

Được duy trì bởi IoTLabs Team.
