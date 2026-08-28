# Control Panel

Mỗi thiết bị có một trang **Control** riêng — bảng điều khiển nhỏ, cấu
hình được, để xem và điều khiển đúng thiết bị đó, thay vì phải đọc JSON
thô trong feed tin nhắn. Mở từ mục **Control** trên nav, hoặc từ trang của
chính thiết bị.

## Control là gì

Một control là một thứ bạn muốn xem hoặc điều khiển — giá trị nhiệt độ,
công tắc relay — gắn với một field thật mà thiết bị thực sự phát ra. Mỗi
control hiển thị qua một **widget**, kiểu hiển thị/tương tác bạn chọn lúc
thêm control.

Hiện có 2 loại control:

| Loại | Gắn với | Widget |
|---|---|---|
| Giá trị cảm biến | field telemetry (vd `temperature_c`) | Label + value, hoặc Min / max / current |
| Công tắc bật/tắt | target trong status (vd `relay_1`) | Toggle switch |

Switch của control công tắc điều khiển thiết bị trực tiếp — bật/tắt sẽ
gửi đúng command `set` như form gửi lệnh trên trang thiết bị.

## Gắn control — gõ tay tên field

IoTStack không biết thiết bị của bạn phát field gì; không có cơ chế tự
phát hiện. Thêm control nghĩa là gõ đúng tên key JSON (cho giá trị cảm
biến) hoặc target (cho công tắc), phân biệt hoa/thường, khớp đúng với
những gì firmware thực sự gửi. Gõ sai chính tả thì widget chỉ hiện không
có dữ liệu — kiểm tra feed "Recent messages" của thiết bị trước để xác
nhận tên field thật.

## Min/max tính trong tin nhắn gần đây, không phải lịch sử

Widget Min/max/current tính khoảng giá trị từ các tin nhắn gần đây nhất
của thiết bị (cùng feed trang thiết bị hiển thị), không phải rollup lịch
sử được lưu trữ. Giá trị này sẽ đổi khi tin nhắn cũ trôi ra khỏi cửa sổ
đó — đây là ảnh chụp hành vi gần đây, không phải biểu đồ dài hạn như trang
[Theo dõi tài nguyên](005_resource-monitoring.vi.md).

## Chỉnh sửa control

Bấm **Edit** trên trang Control của thiết bị để thêm, sắp xếp lại, xóa
control, hoặc đổi widget của một control (chỉ hiện dropdown khi loại đó có
nhiều hơn 1 widget phù hợp). Thay đổi được lưu thành một bộ khi bấm
**Xong** — không lưu từng control riêng lẻ khi đang chỉnh.
