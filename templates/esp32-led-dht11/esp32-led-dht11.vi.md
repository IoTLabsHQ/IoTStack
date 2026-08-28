# Điều khiển bật tắt đèn dùng ESP32

Bật/tắt đèn LED có sẵn trên board ESP32 ngay từ trình duyệt, xem trạng thái đèn thời gian thực, và xem nhiệt độ/độ ẩm — tất cả qua MQTT bảo mật (MQTTS). Chỉ cần một board ESP32 trần là chạy được; cảm biến DHT11 thật là tùy chọn.

## Tính năng

- **Bật/tắt đèn LED** — dùng LED có sẵn trên board, không cần đấu nối thêm.
- **Xem trạng thái đèn** — phản ánh đúng trạng thái thiết bị báo về, không chỉ hiển thị theo lần bấm gần nhất.
- **Xem nhiệt độ/độ ẩm từ DHT11** — có chế độ mô phỏng nếu bạn chưa có cảm biến thật, để thử trọn vẹn luồng chỉ với mỗi board.

## Phần cứng

| Thành phần | Bắt buộc? |
|---|---|
| Board ESP32 (một trong các board hỗ trợ) | Có |
| Cảm biến nhiệt độ/độ ẩm DHT11 | Không — giữ "Mô phỏng DHT11" bật để bỏ qua |

## Sơ đồ nối chân (chỉ khi dùng DHT11 thật)

Nếu tắt chế độ mô phỏng DHT11, nối cảm biến thật như sau:

- `VCC` của DHT11 → chân `3.3V` của board
- `GND` của DHT11 → chân `GND` của board
- `DATA` của DHT11 → chân data của board (hiển thị trong code sinh ra)

Nếu module DHT11 không có sẵn điện trở pull-up, thêm điện trở 10kΩ giữa `DATA` và `3.3V`.

Không cần đấu nối gì cho đèn LED — đó là LED có sẵn trên board.
