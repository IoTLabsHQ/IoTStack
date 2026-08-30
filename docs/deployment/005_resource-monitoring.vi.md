# Theo Dõi Tài Nguyên

IoTStack tự theo dõi tài nguyên của chính mình theo thời gian thực, để bạn
không phải đoán mò server đang thoải mái hay đã căng. Trang **Resources**
trên dashboard hiển thị CPU, RAM, disk trực tiếp — cho cả server lẫn từng
service của IoTStack — cùng biểu đồ nhìn lại theo ngày, tuần, tháng, năm.

## Vì sao quan trọng

Tài liệu [yêu cầu server](server-requirements) đưa ra con số để
bạn lên kế hoạch trước khi deploy: 1-2 vCPU, 2 GB RAM, 20-40 GB disk. Theo
dõi tài nguyên là cách bạn xác nhận những con số đó có đúng với usage thật
của bạn khi thiết bị thật đã kết nối, thay vì chỉ tin vào lời hứa. Ba
service của IoTStack khi idle chỉ dùng khoảng 150-300 MB RAM tổng cộng —
phần lớn một VPS 2 GB vẫn còn trống cho OS và những thứ khác.

## Ngưỡng cảnh báo (warn) và nghiêm trọng (critical)

Mỗi chỉ số có hai mức, hiển thị dạng thanh màu trên trang Resources và
banner ở Overview khi vượt một trong hai:

| Chỉ số | Warn | Critical |
|---|---|---|
| RAM host | 70% | 85% |
| CPU host (trung bình, không tính spike) | 70% | 90% |
| Disk host | 80% | 90% |
| Bộ nhớ từng service (so với giới hạn của nó) | 80% | 95% |

Đây là giá trị mặc định hợp lý, không cố định — chỉnh lại từ trang
Resources nếu setup của bạn khác (ví dụ chạy thêm thứ khác trên cùng VPS).
Vượt "warn" nghĩa là "để ý theo dõi"; vượt "critical" nghĩa là "cần hành
động sớm" — giải phóng tài nguyên hoặc chuyển sang VPS lớn hơn.

## Đọc biểu đồ

- **Ngày** hiển thị từng mẫu riêng lẻ, mặc định lấy mỗi 30 giây.
- **Tuần** và **tháng** hiển thị trung bình theo giờ.
- **Năm** hiển thị trung bình theo ngày.

Bản cài mới chỉ có dữ liệu 1 ngày lúc đầu — các view dài hơn sẽ tự đầy dần
theo tuần/tháng/năm trôi qua; không cần cấu hình gì thêm.

## Hoạt động ra sao, tóm tắt

Một agent nhỏ chạy trực tiếp trên server của bạn (không nằm trong
container) để thấy được usage host thật — xem
[Kiến trúc](../reference/001_architecture.vi.md#theo-dõi-tài-nguyên) nếu
muốn chi tiết kỹ thuật. Agent được [installer](installer) tự cài
đặt sẵn; không cần setup gì thêm.
