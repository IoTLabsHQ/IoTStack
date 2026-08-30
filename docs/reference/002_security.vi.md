# Bảo Mật

## Mô hình đe dọa

Dự án này giả định một operator duy nhất (một maker) chạy một instance
cho thiết bị của chính họ, có thể truy cập từ internet công cộng. Các mối
đe dọa thực tế là:

- Credential MQTT của một thiết bị bị lộ (ví dụ trích xuất từ firmware) và
  bị dùng để giả mạo hoặc tấn công thiết bị khác trên cùng broker.
- Brute-force login admin của dashboard.
- Một thiết bị độc hại hoặc hoạt động sai làm ngập broker/storage.
- Dữ liệu lưu trữ bị đọc nếu bản thân server bị xâm nhập.

Dự án này **không** giả định một triển khai multi-tenant nơi các operator
không tin tưởng lẫn nhau cùng dùng chung một instance — xem
[Giới hạn đã biết](#giới-hạn-đã-biết).

## Xác thực và phân quyền thiết bị

Thiết bị xác thực trực tiếp với plugin Dynamic Security của Mosquitto —
username/password, được kiểm tra bởi chính broker, không qua callback tới
service khác. Role của mỗi thiết bị chỉ cấp quyền publish trên đúng 4
topic `telemetry`/`status`/`event`/`ping` của chính nó, và quyền
subscribe+receive trên đúng topic `cmd` của chính nó — không bao giờ gộp
thành một wildcard `devices/{client_id}/#` duy nhất cho cả hai chiều, vì
như vậy device có thể tự publish giả lệnh lên topic `cmd` của chính nó
(tự giả mạo lệnh server) cũng như đọc lại các topic mà nó không có lý do
gì phải đọc. Bản thân client ID được ràng buộc với username tại thời điểm
tạo, nên chỉ password bị lộ thôi không đủ để attacker kết nối lại dưới
một client ID khác.

Ba nhiệm vụ phía server nói chuyện với broker cũng là các principal MQTT
riêng biệt, phạm vi hẹp, không phải một tài khoản dùng chung:
`dynsec-admin` (chỉ `$CONTROL/dynamic-security/*`, dùng để cấp/thu hồi
credential thiết bị), `collector` (chỉ subscribe,
`devices/+/{telemetry,status,event,ping}`, không bao giờ `cmd`), và
`api-command` (chỉ publish, `devices/+/cmd`). Một credential trong 3 cái
này bị lộ cũng không thể dùng để làm 2 việc còn lại, và không cái nào
đụng được tới `$CONTROL` ngoại trừ `dynsec-admin`.

Credential không bao giờ được lưu dưới dạng plaintext có thể khôi phục
hay ciphertext có thể đảo ngược ở bất kỳ đâu trong database riêng của dự
án này. Bảng `devices` chỉ chứa metadata hiển thị (tên, client ID,
timestamp); password thật nằm hoàn toàn trong store của plugin Dynamic
Security Mosquitto — giống mọi auth store hợp lý khác, chỉ nhận password
mới chứ không bao giờ trả lại password đã set. Dashboard hiển thị một
credential vừa tạo đúng một lần duy nhất, tại thời điểm tạo hoặc tạo lại.
Nếu bị mất, cách khôi phục đúng duy nhất là tạo lại credential mới; cố
tình không có đường "hiển thị lại password cũ", vì không có gì để hiển
thị cả.

## Xác thực dashboard

Dashboard có đúng một tài khoản, khởi tạo từ `ADMIN_EMAIL`/
`ADMIN_PASSWORD` khi boot lần đầu. Password được bcrypt-hash khi lưu trữ.
Login phát hành một session token dạng bearer (32 byte ngẫu nhiên), giữ
trong `sessionStorage` của trình duyệt (xóa khi đóng tab) và gửi kèm
header `Authorization: Bearer` ở mọi API call — cùng pattern được dùng ở
nơi khác cho các dashboard admin nội bộ nhỏ, không phải scheme tự nghĩ
riêng cho dự án này.

Login thất bại được theo dõi theo từng địa chỉ email: 10 lần thất bại
trong cửa sổ 5 phút sẽ khóa tài khoản đó 5 phút, không phụ thuộc IP nguồn.
(Giới hạn theo IP không có nhiều ý nghĩa phía sau hầu hết reverse proxy
nếu không có cấu hình thêm để giữ đúng địa chỉ client thật, nên đây theo
dõi đúng thứ thực sự nhận diện một cuộc tấn công — nhiều lần thử liên tiếp
vào cùng một tài khoản.)

## Validation input

Mọi field đọc từ request body đều được kiểm tra kiểu tại runtime
(`requireString`/`optionalString` trong `validation.ts`) trước khi tới
một câu query SQL. Toàn bộ SQL dùng parameterized query qua
`better-sqlite3` — không nối chuỗi trực tiếp vào SQL text ở bất kỳ đâu
trong codebase này.

## Rate limiting và giới hạn dung lượng

Áp dụng theo từng thiết bị, giá trị có thể cấu hình theo từng deployment
(`RATE_LIMIT_MSG_PER_MIN`, `STORAGE_CAP_MB`) — không có phân tầng theo
gói, chỉ một bộ giới hạn phẳng cho cả instance, vì một instance
self-hosted chỉ có một operator tự set giới hạn cho thiết bị của chính
họ. Riêng một giới hạn per-message (`MAX_PAYLOAD_BYTES`,
`MAX_PAYLOAD_KEYS`, `MAX_PAYLOAD_DEPTH`) từ chối một tin nhắn đơn lẻ quá
lớn hoặc lồng sâu tùy ý ngay trước khi nó kịp tính vào cap dung lượng
tổng.

Kiểm tra giới hạn dung lượng là một `UPDATE` SQL atomic duy nhất (kiểm
tra và tăng trong cùng một câu lệnh), không phải đọc-rồi-ghi riêng biệt —
SQLite serialize mọi writer trên file database, nên không có khoảng hở
nào để hai tin nhắn đồng thời cùng vượt qua kiểm tra rồi cùng đẩy usage
vượt giới hạn. Loại race condition cụ thể này là một lớp bug có thật, đã
từng gặp trong database phân tán; mô hình single-writer của SQLite loại
bỏ nó về mặt cấu trúc thay vì phải cẩn thận khóa ở tầng ứng dụng.

## Bảo mật transport

- **Dashboard/API luôn truy cập được qua HTTP thường trên IP của server,
  vô điều kiện.** Site block `:80` của Caddy không liên quan gì tới
  domain/SNI matching, nên điều này không bao giờ phụ thuộc vào việc
  cấu hình nào đó có đúng hay không — đây là fallback được đảm bảo.
- **Domain là tùy chọn và do dashboard quản lý**, không phải qua `.env`.
  Set hoặc đổi domain (trang Settings → `PUT /settings/domain`) ghi vào
  SQLite, sau đó `api` đẩy *toàn bộ* config live của Caddy lên qua
  `POST http://caddy:2019/load` (admin API của Caddy) — hot-swap toàn bộ
  config đang chạy, không restart. Admin API của Caddy bind vào
  `0.0.0.0:2019` để `api` truy cập được qua docker network, nhưng
  **không bao giờ publish ra host** — không gì ngoài ba container này
  chạm tới được. HTTPS tự động (Let's Encrypt) sau đó áp dụng cho domain
  mới theo cách thông thường.
- **MQTT**: plain (1883) và WebSocket (9001) luôn sẵn sàng; MQTTS (8883)
  kích hoạt khi đã có chứng chỉ cho domain đang cấu hình. Mosquitto không
  có HTTP server riêng để hỏi `api` domain hiện tại, nên `api` ghi domain
  vào một file nhỏ trên volume dùng chung với mosquitto
  (`/settings-shared/domain.txt`) mỗi khi thay đổi (và ghi lại mỗi khi
  `api` boot, như một cơ chế self-heal); mosquitto poll file đó mỗi 30
  giây. Mosquitto và Caddy dùng chung một chứng chỉ (Caddy lấy về, sync
  vào volume của Mosquitto) thay vì chạy hai ACME client riêng, và không
  tự hot-reload chứng chỉ, nên cùng vòng poll 30 giây đó cũng bắt được
  việc gia hạn chứng chỉ — một instance cấu hình tốt sẽ thấy bản mới
  trong vòng nửa phút, không phải ngay lập tức. Ghi rõ như vậy thay vì
  hứa hẹn zero-downtime, vì việc reload broker mất chưa tới một giây,
  không phải hoàn toàn vô hình.
- **Agent theo dõi tài nguyên** (`iotstack-agent`, một process riêng trên
  host VPS — xem [Kiến trúc](001_architecture.vi.md#theo-dõi-tài-nguyên))
  được `api` truy cập qua một unix socket — agent lắng nghe tại
  `/run/iotstack-agent/agent.sock` trên host (dùng `RuntimeDirectory` của
  systemd, vì `/run` gốc của host thuộc quyền root còn agent chạy dưới
  user non-root riêng), bind-mount vào `/run/iotstack-agent.sock` bên
  trong container `api`. Socket
  này để mode world-connectable (`0666`) thay vì giới hạn theo uid, vì nó
  chỉ phục vụ số liệu usage read-only, không nhạy cảm — không credential,
  không thao tác điều khiển — và vốn dĩ không thể truy cập được từ ngoài
  filesystem namespace của chính host này. Lựa chọn này thay cho TCP port
  để tránh hẳn câu hỏi về network exposure mà cách loopback/host-gateway
  sẽ gặp phải, và thay cho việc bind-mount `/proc`/`/sys` thẳng vào `api`,
  vốn sẽ mở rộng quyền truy cập của riêng container đó nhiều hơn hẳn so
  với một file socket duy nhất.

## Email (SMTP)

Tùy chọn, tắt theo mặc định. Trang Settings của dashboard nhận credential
SMTP, nhưng chỉ lưu lại một khi server đã mở kết nối thật và xác minh
thành công — một lần thử thất bại không bao giờ đụng vào cấu hình
(đang hoạt động) đã lưu trước đó, nên tính năng không thể âm thầm rơi
vào trạng thái "đã cấu hình nhưng hỏng". Password SMTP được lưu trong
SQLite, cùng trust boundary với mọi secret khác của dự án này
(`DYNSEC_CONTROLLER_PASSWORD` trong `.env`, credential thiết bị trong
store riêng của Mosquitto) — chỉ ai đọc được filesystem của server mới
đọc được, mà điều đó vốn đã là "game over" cho một instance một
operator. Nó không bao giờ được trả về trong bất kỳ API response nào;
lưu lại cấu hình SMTP luôn yêu cầu nhập lại password.

## An toàn khi khởi động

Service `api` từ chối khởi động khi `NODE_ENV=production` và bất kỳ giá
trị nào trong `ADMIN_PASSWORD`, `SESSION_SECRET`,
`DYNSEC_CONTROLLER_PASSWORD`, `MQTT_COLLECTOR_PASSWORD`, hoặc
`MQTT_API_COMMAND_PASSWORD` vẫn còn khớp giá trị placeholder trong
`.env.example` — bắt lỗi "quên đổi secret mặc định trước khi deploy"
ngay lúc khởi động thay vì âm thầm chạy với một password ai cũng biết.

## Giới hạn đã biết

Ghi rõ thay vì giấu đi, theo tinh thần không overclaim:

- **Không scale ngang.** Rate limiting và login backoff nằm trong bộ nhớ
  của process, chỉ đúng khi `api` chạy dạng single-instance (hình thức
  triển khai duy nhất được hỗ trợ hiện nay — xem
  [Kiến trúc](architecture) để hiểu vì sao). Chạy nhiều hơn một
  replica `api` sẽ âm thầm nhân rate limit thực tế của mọi thiết bị lên
  theo số replica.
- **Không có backoff xác thực ở tầng thiết bị.** Vì Mosquitto tự xác thực
  thiết bị (không qua callback do dự án này kiểm soát), không có hook nào
  để đếm và khóa các lần login thiết bị thất bại liên tiếp theo cách
  login của dashboard được bảo vệ. Mosquitto cũng không có cơ chế chống
  brute-force sẵn cho việc này. Với một số lượng nhỏ thiết bị đáng tin
  trên instance của một maker, đây là một đánh đổi hợp lý, nhưng là một
  khoảng trống thật so với một nền tảng multi-tenant chuyên dụng.
- **Không tính lại retention khi đổi plan.** Hạn retention của một tin
  nhắn được cố định tại thời điểm insert, theo giá trị `RAW_RETENTION_DAYS`
  đang hiệu lực lúc đó. Đổi setting này sau đó không tính lại hạn cho các
  tin nhắn đã lưu từ trước.
- **Không cluster RabbitMQ/Mosquitto.** Dự án này nhắm tới một broker
  trên một VPS. Nếu lượng tin nhắn hoặc số thiết bị vượt quá một VPS nhỏ,
  hướng đúng là dùng VPS lớn hơn hoặc chuyển sang một nền tảng IoT
  multi-tenant chuyên dụng — không phải cluster broker của dự án này, vốn
  không được thiết kế cho việc đó.
- **Reload chứng chỉ/domain không tức thời.** Xem phần bảo mật transport
  ở trên — một chứng chỉ MQTTS mới gia hạn hoặc thay đổi có thể mất tới
  30 giây để Mosquitto nhận ra.

## Báo cáo lỗ hổng bảo mật

Mở một issue trong repository này, hoặc liên hệ trực tiếp maintainer nếu
vấn đề liên quan chi tiết nhạy cảm bạn không muốn đăng công khai.
