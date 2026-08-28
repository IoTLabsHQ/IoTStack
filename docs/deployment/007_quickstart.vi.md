# Bắt Đầu Nhanh

Cách nhanh nhất để thấy IoTStack chạy thật: chọn một dự án mẫu ngay trên trang chủ dashboard, đi qua một wizard ngắn, và có ngay một thiết bị thật để xem/điều khiển trên web — luôn qua MQTT bảo mật (MQTTS).

## Trước khi bắt đầu — thiết lập domain

MQTT bảo mật (port 8883) chỉ hoạt động khi instance của bạn đã có domain kèm chứng chỉ — xem [Bảo mật](../reference/002_security.vi.md#bảo-mật-transport). Trên trang Settings, thiết lập domain rồi để ý dòng "HTTPS is active for …" — đó mới là tín hiệu sẵn sàng thật, không chỉ là đã gõ domain. Cấp chứng chỉ cộng với vòng poll ~30 giây của Mosquitto nghĩa là "vừa lưu" chưa chắc "sẵn sàng ngay".

Mọi đường sinh code của tính năng này (cả wizard template bên dưới lẫn [Arduino code generator theo thiết bị](../reference/001_architecture.vi.md)) đều từ chối sinh code nếu chưa có domain — không có chế độ plain MQTT dự phòng.

## Chọn dự án

Từ **Overview**, bấm **"Chạy thử dự án mẫu"**. Template đầu tiên có sẵn là **"Điều khiển bật tắt đèn dùng ESP32"**: bật/tắt đèn LED có sẵn trên board từ web, xem trạng thái đèn thời gian thực, và xem nhiệt độ/độ ẩm từ DHT11 — có chế độ mô phỏng, nên chỉ cần một board ESP32 trần là thử được toàn bộ.

Chọn board (đúng 3 board mà Arduino code generator hỗ trợ), và chọn có mô phỏng DHT11 hay dùng cảm biến thật.

## Tạo dự án

Bấm **Tạo**. Một wizard ngắn sẽ chạy qua:

1. Khởi tạo project
2. Khởi tạo thiết bị và controls
3. Xác nhận MQTT đã sẵn sàng (dừng ở đây nếu chưa có domain — thiết lập rồi quay lại)
4. Cập nhật credential thật của thiết bị vào Arduino code
5. Hoàn thành

## Nạp code và xem kết quả

Tải file `.ino` sinh ra, mở bằng Arduino IDE, điền WiFi SSID/password, rồi nạp vào board. Theo dõi Serial Monitor: kết nối WiFi → đồng bộ giờ NTP → kết nối MQTTS → phát telemetry/status. Sau đó mở trang **Control** của thiết bị — wizard đã cấu hình sẵn control khớp, nên dữ liệu và nút bật/tắt đèn sẽ hoạt động ngay khi thiết bị kết nối.

## Xử lý sự cố

- **Nút Tạo bị khoá / thông báo "cần domain"**: thiết lập domain ở Settings trước, và chờ khoảng một phút để chứng chỉ thực sự sẵn sàng.
- **Serial Monitor kẹt ở `rc=-4 (certificate verify failed)`**: board chưa đồng bộ giờ qua NTP (kiểm tra UDP/123 ra ngoài không bị chặn), hoặc chứng chỉ trên domain chưa lan tới Mosquitto (chờ tới 30 giây sau khi đổi domain/chứng chỉ).
- **Không thấy gì trên trang Control**: kiểm tra "Recent messages" trên trang thiết bị trước — nếu tin nhắn vẫn về nhưng trang Control trống, tên field của control không khớp đúng với payload thật.
