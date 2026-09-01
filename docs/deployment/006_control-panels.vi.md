# Control Panel

Mỗi thiết bị có một trang **Control** riêng — bảng điều khiển nhỏ, cấu
hình được, để xem và điều khiển đúng thiết bị đó, thay vì phải đọc JSON
thô trong feed tin nhắn. Mở từ mục **Control** trên nav, hoặc từ trang của
chính thiết bị.

## Control là gì

Một control là một thứ bạn muốn xem hoặc điều khiển — giá trị nhiệt độ,
công tắc relay, sự kiện gần nhất — gắn với một field (hoặc loại tin nhắn)
thật mà thiết bị thực sự phát ra. Mỗi control hiển thị qua một **widget**,
kiểu hiển thị/tương tác bạn chọn lúc thêm control.

Hiện có 3 loại control:

| Loại | Gắn với | Widget |
|---|---|---|
| Giá trị cảm biến | field telemetry (vd `temperature_c`, hoặc path lồng nhau như `gps.lat`) | Label + value, Min / max / current, hoặc History chart |
| Công tắc bật/tắt | target + field trong status (vd target `relay_1`, field `state`) | Toggle switch, hoặc Label + value (chỉ xem) |
| Sự kiện gần nhất | tin nhắn `event` của thiết bị, có thể lọc theo 1 `type` | Latest event |

Switch của control công tắc điều khiển thiết bị trực tiếp — bật/tắt sẽ
gửi đúng command `set` như form gửi lệnh trên trang thiết bị, sau đó hiện
trạng thái loading cho đến khi nhận được phản hồi thật từ thiết bị (xem
mục "Lệnh công tắc chờ phản hồi thật" bên dưới). Widget Label + value
trên control công tắc chỉ để xem — dùng để hiển thị nhanh cùng
target/field đó mà không có switch bấm được.

## Gắn control — chọn từ định dạng tin nhắn thật của thiết bị

IoTStack không biết trước thiết bị của bạn phát field gì; không có bước
đăng ký schema. Thay vào đó, khi đang chỉnh control, một panel **Message
formats** bên phải hiển thị các định dạng tin nhắn thật mà thiết bị đã
gửi — đã lọc trùng theo cấu trúc (không theo giá trị, nên mười tin nhắn
telemetry cùng key sẽ gộp thành một định dạng hiển thị), nhóm theo loại
tin nhắn:

- **Telemetry** — mọi định dạng khác nhau đã thấy, kèm danh sách `Fields:`
  các field path bấm được.
- **Status** — nhóm theo `target` trước (target khác nhau có thể mang
  field khác nhau), rồi theo định dạng trong từng target.
- **Event** / **Ping** — chỉ hiển thị để tham khảo (không gắn được vào
  control).

Để gắn 1 control: bấm **+ Add control** (hoặc **Edit** một control đã
có), chọn **Type**, rồi bấm vào input **Telemetry field** hoặc **Status
field** của nó — panel sẽ highlight các field khớp thành nút bấm được.
Bấm 1 field sẽ tự điền vào input. Vẫn có thể gõ tay tên field nếu đã biết
sẵn hoặc thiết bị chưa gửi tin nhắn khớp.

**Field lồng nhau** dùng ký hiệu dấu chấm: payload như
`{ "gps": { "lat": 10.7, "long": 106.6 } }` sẽ cho chọn (hoặc gõ tay)
`gps.lat` và `gps.long` — không chỉ key ở cấp ngoài cùng.

## Sửa binding của control đã có

Chỉnh sửa không chỉ giới hạn ở đổi tên hoặc đổi widget — **Telemetry
field** của control `sensor-numeric` và **Status target**/**Status
field** của control `toggle` đều sửa được sau khi tạo, cùng panel gợi ý
field áp dụng luôn ở đây. Gắn lại control vào field khác mà không cần
xóa rồi thêm lại.

## Min/max tính trong tin nhắn gần đây, không phải lịch sử

Widget Min/max/current tính khoảng giá trị từ các tin nhắn gần đây nhất
của thiết bị (cùng feed trang thiết bị hiển thị), không phải rollup lịch
sử được lưu trữ. Giá trị này sẽ đổi khi tin nhắn cũ trôi ra khỏi cửa sổ
đó — đây là ảnh chụp hành vi gần đây. Muốn xem dài hạn thật sự, dùng
widget History chart bên dưới.

## History chart — xu hướng thật theo thời gian

Widget History chart vẽ giá trị cảm biến theo thời gian, chuyển đổi
giữa **Day / Week / Month / Year** — cùng bộ chọn khoảng thời gian như
trang [Theo dõi tài nguyên](resource-monitoring). Day đọc trực tiếp tin
nhắn gần đây của thiết bị; Week/Month/Year đọc từ rollup hourly/daily
được tính mỗi giờ 1 lần, nên control mới thêm sẽ cần vài giờ để các mốc
xa hơn có đủ dữ liệu, thay vì hiện ngay lập tức (Day không bị ảnh hưởng
— đó là dữ liệu trực tiếp). Giống hệt cách trang Theo dõi tài nguyên
"chỉ có 1 ngày dữ liệu lúc mới cài, rồi tự đầy dần".

## Dung lượng dữ liệu thiết bị

Tách biệt với control, trang riêng của mỗi thiết bị (không phải trang
Control) có biểu đồ **Data usage** — số byte và số tin nhắn gửi theo
từng khoảng, cùng bộ chọn Day/Week/Month/Year, nằm cạnh dòng "Storage
used" (tổng dung lượng hiện có). Storage used không bao giờ reset (nó
kiểm soát cap dung lượng của thiết bị); biểu đồ Data usage dùng để phát
hiện xu hướng bất thường — thiết bị đột nhiên gửi nhiều hơn hẳn bình
thường thường là dấu hiệu đầu tiên của lỗi firmware hoặc vòng lặp cảm
biến bị hỏng.

## Lệnh công tắc chờ phản hồi thật

Bấm switch không chỉ đổi UI ngay theo kiểu lạc quan: nó hiện spinner
loading ngay lập tức, gửi command `set`, rồi tiếp tục loading cho đến khi
thiết bị gửi lại một tin nhắn `status` khớp (hoặc tối đa 15 giây trôi qua
mà không có phản hồi, lúc đó loading tắt mà không giả định là thành
công). Nghĩa là switch luôn phản ánh đúng những gì thiết bị thực sự báo
về, không chỉ là lần bấm cuối cùng — hữu ích để phát hiện lệnh không đến
được thiết bị (mất kết nối, offline).

## Firmware version / cường độ tín hiệu

Nếu firmware của thiết bị báo `firmware_version` và/hoặc `wifi_rssi`
trong bất kỳ tin nhắn nào (ping hoặc status), thông tin này hiện dưới
tiêu đề thiết bị ở cả trang Devices và trang Control — vd "Firmware 1.0.0
· RSSI -76 dBm". Dữ liệu này đọc trực tiếp từ feed tin nhắn, không phải
bước cấu hình riêng; firmware nào không gửi các field này thì đơn giản
là dòng đó không hiện.

## Chỉnh sửa control

Bấm **Edit** trên trang Control của thiết bị để thêm, sắp xếp lại, xóa
control, hoặc đổi widget/binding của một control. Thay đổi được lưu
thành một bộ khi bấm **Xong** — không lưu từng control riêng lẻ khi đang
chỉnh.
