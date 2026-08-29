# Quick Start templates — ghi chú bảo trì

Mỗi thư mục con ở đây (`template.json` + `<id>.ino` + `<id>.en.md` + `<id>.vi.md`) là một sample project đầy đủ cho gallery "Quick Start" trên dashboard — chọn 1 cái là ra ngay device + control panel khớp sẵn + code nạp sẵn (xem `dashboard/src/pages/TemplateDetailPage.tsx`).

## Luôn cập nhật template khi engine đổi

`IoTStack` còn đang phát triển, tính năng đổi thường xuyên (loại control mới, topic MQTT mới, hành vi firmware mới...). Template rất dễ bị lag phía sau engine nếu quên cập nhật — ví dụ đã từng xảy ra: thêm `type: "event"` + widget `latest-event` cho Control Panel (`api/src/dashboard-config.ts`) nhưng `template.json` không có control nào minh hoạ nó; firmware boot sequence đổi (status ngay sau boot, ping định kỳ — xem PRD §12) nhưng bản `.ino` cũ không phát sinh đúng thứ tự đó.

Khi một thay đổi ảnh hưởng tới thứ mà template mô tả — loại/binding control mới, topic mới, thứ tự publish khi boot, ACL/permission ảnh hưởng tới sample code — hãy rà lại từng `templates/*/template.json` và `templates/*/*.ino` xem có cần cập nhật theo không, đừng chỉ sửa engine rồi để đó.

## Test phần cứng thật: dùng lại thiết bị/template đã có, đừng tạo mới tuỳ tiện

Khi cần test trên board thật (flash `.ino`, verify qua MQTT/API thật), **dùng lại template đã có sẵn ở đây và device test đã được tạo cho việc test** — không tự tạo device mới hay template mới chỉ để chạy một lượt test, trừ khi việc đó được yêu cầu rõ ràng. Nếu không chắc có nên tạo mới hay không, hỏi lại trước khi tạo.

Lý do: mỗi device mới tạo (nhất là trên VPS demo) là thêm một bộ credential/state phải dọn dẹp sau này, và test lặp lại trên cùng 1 device/template giúp so sánh kết quả giữa các lần dễ hơn.
