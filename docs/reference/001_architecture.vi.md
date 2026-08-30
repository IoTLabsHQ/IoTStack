# Kiến Trúc

## Tổng quan

```
Browser/ESP32 ──HTTP (hoặc HTTPS khi đã set domain)──► Caddy (reverse proxy)
                                 ├─► dashboard (static SPA, tích hợp sẵn)
                                 └─► api:3000 (REST, /api/*)

ESP32 ──MQTT :1883, MQTTS :8883, WS :9001── Mosquitto (+ plugin Dynamic Security)
                                                │
                                                │  $CONTROL/dynamic-security/v1
                                                │  (principal dynsec-admin, quản lý credential/ACL)
                                                │
                                                │  devices/+/{telemetry,status,event,ping}
                                                │  (principal collector, chỉ subscribe, QoS 1)
                                                │
                                                │  devices/+/cmd
                                                │  (principal api-command, chỉ publish, QoS 1)
                                                ▼
                                              api ──► SQLite (một file duy nhất)
```

Ba container:

- **mosquitto** — MQTT broker thực sự (Eclipse Mosquitto), cộng với plugin
  Dynamic Security tích hợp sẵn để xác thực và phân quyền topic theo từng
  thiết bị. Không có auth backend riêng, không có HTTP callback mỗi lần
  kết nối — broker tự sở hữu identity và access control.
- **api** — một service Node.js/Express nhỏ với ba nhiệm vụ, mỗi nhiệm vụ
  qua kết nối MQTT riêng, xác thực bằng một principal riêng biệt, phạm vi
  hẹp (không có tài khoản dùng chung "làm được mọi thứ"):
  1. REST API cho dashboard (login, CRUD thiết bị, truy vấn tin nhắn/thống
     kê).
  2. Đẩy thay đổi credential/ACL vào plugin Dynamic Security của Mosquitto
     khi một thiết bị được tạo, tạo lại, hoặc xóa (principal
     `dynsec-admin` — chỉ `$CONTROL/dynamic-security/*`).
  3. Subscribe `devices/+/{telemetry,status,event,ping}` như một collector,
     lưu tin nhắn vào SQLite và áp dụng rate limit + giới hạn dung lượng
     lưu trữ (principal `collector` — chỉ đọc, không bao giờ thấy `cmd` vì
     đó là server→device, không phải tin nhắn cần thu thập). Publish lệnh
     điều khiển thiết bị qua một kết nối khác nữa (principal
     `api-command` — chỉ publish, `devices/+/cmd`).
- **caddy** — reverse proxy và static file server cho dashboard. Luôn phục
  vụ HTTP thường trên `:80` — không liên quan domain, TLS/SNI, nên truy
  cập qua IP luôn hoạt động vô điều kiện. `api` có thể đẩy một site block
  HTTPS theo domain cụ thể lên đây trực tiếp qua admin API của Caddy
  (`POST /load`, hot-swap toàn bộ config, không restart) mỗi khi trang
  Settings của dashboard set hoặc đổi domain. HTTPS tự động (Let's Encrypt)
  áp dụng cho domain đó theo cách thông thường sau khi được đẩy lên.

Mọi thứ được thiết kế single-instance — nhắm tới một maker chạy một
broker cho thiết bị của chính họ, không phải triển khai multi-tenant.
Lựa chọn này giúp đơn giản hóa vài thứ nêu bên dưới (không có state
rate-limiter phân tán, không có session store nào ngoài một map trong bộ
nhớ).

## Định danh thiết bị và cô lập topic

Mỗi thiết bị có một `client_id`, dùng vừa làm định danh MQTT vừa làm tiền
tố của mọi topic thiết bị được phép dùng: `devices/{client_id}/...`.

Khi một thiết bị được tạo, `api` gửi nhiều lệnh tới plugin Dynamic Security
của Mosquitto qua topic API `$CONTROL/dynamic-security/v1`:

1. `createRole` — một role chỉ dành riêng cho thiết bị này
   (`role_{client_id}`).
2. `addRoleACL`, mỗi lệnh một topic — quyền publish trên đúng 4 topic
   `telemetry`/`status`/`event`/`ping` của chính thiết bị đó, và quyền
   subscribe+receive trên đúng topic `cmd` của chính nó. Cố tình **không**
   gộp thành một wildcard `devices/{client_id}/#` duy nhất cho cả hai
   chiều — vì như vậy device có thể tự publish giả lệnh lên topic `cmd`
   của chính nó (tự giả mạo lệnh server) hoặc subscribe các topic
   sensor/state mà nó không có lý do gì phải đọc lại.
3. `createClient` — username/password của thiết bị, với `clientid` được
   ràng buộc với đúng `client_id` đó. Ràng buộc client ID của kết nối với
   username nghĩa là chỉ có password bị lộ thôi chưa đủ để kết nối dưới
   một identity khác — client ID cũng phải khớp.

> **Vì sao không dùng một role dùng chung với pattern placeholder `%c`
> (client-id)?**
> Plugin Dynamic Security của Mosquitto có ghi tài liệu về việc thay thế
> `%c`/`%u` trong pattern topic của role ACL (ví dụ một role với
> `devices/%c/#` bao phủ mọi thiết bị). Đã xác minh trực tiếp trên broker
> thật rằng điều này **không** áp dụng cho `subscribePattern` ở phiên bản
> dự án này pin — một client dùng rule dựa trên `%c` bị từ chối subscribe
> hoàn toàn. Một role riêng cho từng thiết bị với topic cụ thể được tính
> trong code ứng dụng hoạt động đúng và đã được xác nhận bằng một round
> trip publish/subscribe thật cộng với kiểm tra cô lập chéo giữa các thiết
> bị (tin nhắn của thiết bị này không thấy được từ thiết bị khác). Nếu một
> bản Mosquitto tương lai sửa hành vi thay thế này, gộp về một role dùng
> chung có tham số sẽ giảm state của plugin, nhưng không bắt buộc để đảm
> bảo tính đúng đắn.

Toàn bộ việc này diễn ra live qua message MQTT — không reload file config,
không restart broker, không có khoảng thời gian nào mà thiết bị vừa tạo
chưa kết nối được.

## Pipeline thu thập tin nhắn

Collector của `api` subscribe `devices/+/{telemetry,status,event,ping}` ở
QoS 1 — 4 topic filter tường minh, không bao giờ `devices/#`, và không bao
giờ `cmd` (server→device, không phải thứ cần thu thập) — dùng principal
MQTT `collector` riêng, chỉ-subscribe, tách biệt khỏi tài khoản
`dynsec-admin` quản lý Dynamic Security. Với mỗi tin nhắn:

1. **Kiểm tra hình dạng topic** — phải đúng 3 segment
   `devices/{client_id}/{loại}`, root là `devices`. Sai định dạng bị loại
   ngay.
2. **Kiểm tra loại tin nhắn** — segment cuối của topic phải là một trong
   `telemetry`, `status`, `event`, `ping`. Bất kỳ loại nào khác (kể cả
   `cmd`, thứ collector còn không subscribe tới) đều bị loại.
3. **Tra thiết bị** — segment `client_id` của topic phải khớp một thiết bị
   đã biết. Client ID không xác định bị loại (chỉ xảy ra với thiết bị đã
   từng tồn tại rồi bị xóa, hoặc topic sai định dạng — ACL ở tầng broker
   đã ngăn không cho ai publish dưới `client_id` không thuộc về mình).
4. **Giới hạn payload** — bị loại nếu vượt `MAX_PAYLOAD_BYTES`, hoặc (với
   payload JSON) có nhiều hơn `MAX_PAYLOAD_KEYS` key hoặc lồng sâu hơn
   `MAX_PAYLOAD_DEPTH`. Giới hạn tác động lưu trữ/CPU của một thiết bị,
   độc lập với cap tổng dung lượng bên dưới.
5. **Rate limit** — bộ đếm cửa sổ cố định 1 phút cho mỗi thiết bị, trong
   bộ nhớ (`RATE_LIMIT_MSG_PER_MIN`). Vượt giới hạn → bị loại âm thầm.
6. **Giới hạn dung lượng** — một `UPDATE` SQL atomic duy nhất trên dòng
   `storage_usage` của thiết bị, kiểm tra và tăng trong cùng một câu lệnh
   SQL (`STORAGE_CAP_MB`). Mô hình single-writer của SQLite khiến việc
   này vốn dĩ không có race condition — xem [Bảo mật](security)
   để hiểu vì sao điều đó quan trọng.
7. **Lưu trữ** — ghi vào `messages` với `expires_at` tính từ
   `RAW_RETENTION_DAYS` tại thời điểm insert, sau đó cập nhật
   `devices.last_seen_at`. Không bao giờ cập nhật từ `cmd` (vì không được
   thu thập) hay từ tin nhắn bị loại ở bất kỳ bước nào trên.

Firmware sinh ra giờ cũng đăng ký một MQTT Last Will and Testament thật tại
lúc connect — `devices/{client_id}/event`, `{"type":"network.disconnected"}`
— để một lần ngắt kết nối đột ngột (mất mạng, mất điện) vẫn tạo ra đúng một
message `event` thật dù thiết bị chưa kịp tự publish gì. Được lưu qua đúng
pipeline này, không xử lý riêng. Không đổi ý nghĩa `last_seen_at` (vẫn là
"lần cuối nhận được message thật", không phải trạng thái kết nối live) —
chỉ thêm một loại event phân biệt được nữa bên cạnh `boot`.

Một sweep nền (mỗi giờ) xóa các dòng đã qua `expires_at` — SQLite không có
TTL index sẵn như một số database khác, nên đây là một job định kỳ tường
minh thay thế.

## Data model

Một file SQLite duy nhất (`better-sqlite3`, chế độ WAL). Năm bảng:

- `admin_users` — tài khoản dashboard duy nhất, được khởi tạo từ
  `ADMIN_EMAIL`/`ADMIN_PASSWORD` khi boot lần đầu nếu bảng đang rỗng.
  Password lưu dưới dạng bcrypt hash.
- `devices` — `client_id`, `mqtt_username` (hiện luôn bằng `client_id`),
  tên hiển thị, và timestamp. **Không lưu password MQTT hay hash của
  nó** — thứ đó nằm hoàn toàn trong store của plugin Dynamic Security
  Mosquitto, không bao giờ trả lại một khi đã set. Xem
  [Bảo mật](security) để hiểu điều này có nghĩa gì với UX
  "hiển thị một lần" của credential trên dashboard.
- `messages` — mỗi dòng là một tin nhắn đã lưu, gồm topic, loại, payload,
  kích thước byte, và hạn TTL.
- `storage_usage` — mỗi dòng ứng với một thiết bị, một bộ đếm byte chạy,
  khởi tạo về 0 khi tạo thiết bị để lần kiểm tra giới hạn atomic đầu tiên
  luôn có dòng để đối chiếu.
- `settings` — một dòng duy nhất (`id = 1`): domain hiện tại (rỗng theo
  mặc định), và cấu hình SMTP với `smtp_verified_at` — chỉ khác null một
  khi đã test kết nối thật thành công, đó chính là ý nghĩa thực sự của
  "SMTP đang active" (xem [Bảo mật](security)).

## Vì sao chọn những thứ này thay vì các lựa chọn phổ biến hơn

Phần logic của dự án này (validation, hạch toán dung lượng atomic, rate
limiting, retention TTL, health check phản ánh đúng trạng thái thật của
từng component) được mang qua từ một MQTT service lớn hơn, đã được hardened
trước đó cho một triển khai cloud multi-tenant. Vài lựa chọn hạ tầng được
cố tình làm khác đi ở đây, vì mục tiêu khác — một maker, một VPS nhỏ, vài
chục thiết bị — không phải một nền tảng multi-tenant dùng chung:

- **Mosquitto thay vì một broker AMQP nặng hơn.** Một message broker
  đa dụng có adapter MQTT tốn RAM baseline nhiều hơn đáng kể so với một
  broker được xây riêng cho MQTT. Trên VPS 1-2 GB, khác biệt đó chính là
  khoảng cách giữa dư dả thoải mái và luôn chạy sát trần bộ nhớ.
- **SQLite thay vì database client-server.** Không cần container database
  riêng, không có network hop cho mỗi query, và backup chỉ là "copy một
  file". Một database client-server chỉ đáng dùng ở quy mô — nhiều writer
  đồng thời trên nhiều instance ứng dụng — mà dự án này không hướng tới.
- **Không Redis / shared cache.** Bộ đếm rate-limit và login-backoff nằm
  trong bộ nhớ của process `api`. Điều này chỉ đúng vì service chạy dạng
  single-instance — nếu dự án này cần scale ngang trong tương lai, giả
  định đó cần được xem lại (xem phần giới hạn trong
  [Bảo mật](security)).
- **Plugin Dynamic Security của Mosquitto thay vì HTTP auth callback tự
  viết.** Không thêm network round trip nào mỗi lần kết nối, không cần
  một service riêng phải luôn chạy để thiết bị xác thực được — broker tự
  sở hữu identity.

## Dung lượng tài nguyên

RAM idle ước tính, đo trên các image dự án này pin:

| Service | RAM idle | Ghi chú |
|---|---|---|
| mosquitto | ~15-30 MB | Tăng chậm theo số kết nối; vài chục thiết bị vẫn dưới 50 MB |
| api | ~60-100 MB | Express + better-sqlite3 + mqtt.js |
| caddy | ~20-40 MB | Reverse proxy + phục vụ static file |

`mem_limit` được set trên cả ba service trong `docker-compose.yml` như
một lớp bảo vệ — không phải vì service nào đó dự kiến chạm tới giới hạn
khi dùng bình thường, mà để một thiết bị hoạt động sai (ví dụ firmware bị
lỗi retry-loop) chỉ làm suy giảm đúng container đó thay vì cả VPS.

## Theo dõi tài nguyên

Cả ba container đều không thấy được usage CPU/RAM/disk thật của host — không
có `docker.sock`, không mount `/proc`/`/sys`, không container nào được cấp
privileged mode. Thay vì mở rộng quyền truy cập đó, một process nhỏ
`iotstack-agent` chạy trực tiếp trên host VPS (ngoài Docker, dạng systemd
service): đọc `/proc` để lấy số liệu toàn host, và nói chuyện với Docker
daemon cục bộ để lấy usage từng container (mosquitto/api/caddy), rồi expose
cả hai qua một unix socket. Chỉ `api` được thêm bind mount cho socket đó —
`mosquitto` và `caddy` không đụng gì. `api` poll agent, lưu sample vào
SQLite, và rollup thành dữ liệu theo giờ/ngày để trang Resources trên
dashboard vẽ được biểu đồ usage theo ngày, tuần, tháng, năm mà không làm
bảng dữ liệu thô phình vô hạn. Xem [Bảo mật](security) để hiểu
vì sao chọn unix socket thay vì network port hay mount `/proc` thẳng vào
container.
