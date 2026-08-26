# Hướng dẫn tạo user quản trị cho VPS

Tài liệu này hướng dẫn tạo một user quản trị riêng cho VPS Ubuntu thay vì sử dụng trực tiếp tài khoản `root` trong quá trình vận hành hằng ngày.

Mục tiêu:

- Tạo một user quản trị riêng.
- Thêm user vào nhóm `sudo`.
- Cho phép `sudo` không cần nhập password.
- Sao chép SSH public key từ `root` sang user mới nếu có.
- Khóa password của user mới.
- Chỉ disable SSH login của `root` khi user mới đã có SSH key.
- Người quản trị chủ động chạy script một lần để setup VPS.

> Trong tài liệu này sử dụng username `iotstack` làm ví dụ.

`iotstack` chỉ là **tên user để dễ phân biệt và giúp nhận biết VPS đang được sử dụng cho mục đích hoặc nhóm workload nào**. Đây không phải tên bắt buộc về mặt kỹ thuật.

Có thể thay bằng bất kỳ username nào phù hợp với quy ước quản trị, ví dụ:

```text
deploy
admin
ops
devops
platform
backend
webstack
appserver
```

Trong script chỉ cần thay:

```bash
USER_NAME="iotstack"
```

thành:

```bash
USER_NAME="deploy"
```

hoặc tên mong muốn.

Các đường dẫn liên quan sẽ được tạo tự động dựa trên `${USER_NAME}`.

Ví dụ:

```bash
USER_NAME="deploy"
```

sẽ tạo:

```text
/home/deploy
/etc/sudoers.d/90-deploy
```

---

# 1. Vì sao nên dùng user riêng thay vì đăng nhập `root`

Không nên xóa tài khoản `root`.

Linux vẫn cần tài khoản có:

```text
UID = 0
```

để thực hiện các thao tác quản trị hệ thống.

Điểm cần thay đổi là **không sử dụng `root` như tài khoản SSH và làm việc hằng ngày**.

Thay vào đó:

```text
SSH
 │
 ▼
iotstack
 │
 ├── command thông thường
 │
 └── sudo <command>
        │
        ▼
      root
```

Trong sơ đồ trên, `iotstack` có thể thay bằng bất kỳ username nào.

## So sánh

| Tiêu chí | Đăng nhập trực tiếp bằng `root` | User riêng + `sudo` |
|---|---|---|
| Root exposed trực tiếp qua SSH | 🔴 Có | ✅ Không |
| Quyền mặc định sau khi login | 🔴 Toàn quyền root | ✅ User thường |
| Khi cần quyền hệ thống | ⚠️ Luôn có sẵn | ✅ Chủ động dùng `sudo` |
| Rủi ro khi gõ nhầm command | 🔴 Cao | ✅ Thấp hơn |
| SSH key | ⚠️ `/root/.ssh` | ✅ `/home/<user>/.ssh` |
| File ownership | ⚠️ Dễ tạo file thuộc root | ✅ Ownership rõ ràng |
| Automation | ⚠️ Dễ phụ thuộc root | ✅ Có user quản trị riêng |
| Audit | 🔴 Tất cả thao tác đều là root | ✅ Có identity riêng |
| Nhiều administrator | 🔴 Khó quản lý | ✅ Dễ tạo nhiều user |
| Disable root SSH | 🔴 Không phù hợp nếu vẫn dùng root | ✅ Có thể disable |
| Nhận biết mục đích VPS | ⚠️ Mọi VPS đều là `root` | ✅ Có thể đặt username theo vai trò |
| SSH key rotation | ⚠️ Key tập trung ở root | ✅ Có thể quản lý theo user |
| Thu hồi quyền administrator | 🔴 Khó nếu dùng chung root | ✅ Có thể khóa user/key |
| Giới hạn quyền sau này | 🔴 Không | ✅ Có thể giới hạn `sudo` |
| Provisioning / CI/CD | ⚠️ Có thể dùng nhưng không lý tưởng | ✅ Phù hợp hơn |
| Vận hành server hằng ngày | 🔴 Không khuyến nghị | ✅ Khuyến nghị |

### Ý nghĩa biểu tượng

- ✅ **Recommended** — cách làm nên sử dụng.
- ⚠️ **Warning** — có thể sử dụng nhưng cần hiểu rõ rủi ro.
- 🔴 **Danger** — nên tránh trong vận hành VPS thông thường.

Thay vì:

```bash
ssh root@SERVER_IP
```

sau khi setup nên sử dụng:

```bash
ssh iotstack@SERVER_IP
```

Khi cần quyền hệ thống:

```bash
sudo <command>
```

Ví dụ:

```bash
sudo apt update
sudo systemctl restart ssh
sudo journalctl -xe
```

## Lưu ý về `NOPASSWD`

Script trong tài liệu cấu hình:

```text
iotstack ALL=(ALL:ALL) NOPASSWD: ALL
```

Điều đó có nghĩa user `iotstack` có thể chạy:

```bash
sudo -i
```

và trở thành root mà không cần nhập password.

Vì vậy:

```text
User riêng + NOPASSWD
        │
        ├── ✅ Không expose root trực tiếp qua SSH
        ├── ✅ Có identity quản trị riêng
        ├── ✅ Có SSH key riêng
        ├── ✅ Dễ quản lý và audit
        │
        └── ⚠️ Nếu user bị chiếm quyền,
             attacker có thể sudo lên root
```

Đây không phải mô hình least-privilege tuyệt đối, nhưng phù hợp với các VPS cần quản trị và automation đơn giản.

---

# 2. Kiến trúc sau khi setup

Sau khi chạy script:

```text
Ubuntu VPS
│
├── root
│   ├── UID 0
│   ├── vẫn tồn tại
│   └── không cho SSH trực tiếp
│
└── iotstack
    ├── /home/iotstack
    ├── SSH public key
    ├── thuộc nhóm sudo
    └── sudo không cần password
```

Luồng truy cập:

```text
Máy quản trị
     │
     │ SSH public key
     ▼
iotstack@SERVER_IP
     │
     ├── command thông thường
     │
     └── sudo
          │
          ▼
        root
```

Nếu đổi:

```bash
USER_NAME="deploy"
```

thì sử dụng:

```bash
ssh deploy@SERVER_IP
```

---

# 3. Đăng nhập VPS lần đầu

Với VPS mới, đăng nhập bằng root để thực hiện bootstrap ban đầu:

```bash
ssh root@SERVER_IP
```

Giữ session root này mở trong suốt quá trình setup.

Không đóng session root cho đến khi đã xác nhận user mới có thể SSH và dùng `sudo` thành công.

---

# 4. Tạo script setup

Tạo file:

```bash
nano /root/setup-vps-user.sh
```

Thêm nội dung:

```bash
#!/usr/bin/env bash

set -Eeuo pipefail


# ============================================================
# Configuration
# ============================================================

# Administrative username.
#
# This is only a username used to identify the admin account
# and optionally make the VPS purpose easier to recognize.
#
# Change it to any username you want.
#
# Examples:
#   iotstack
#   deploy
#   admin
#   ops
#   devops
#   platform
#
USER_NAME="iotstack"

USER_HOME="/home/${USER_NAME}"

SUDOERS_FILE="/etc/sudoers.d/90-${USER_NAME}"

SSH_CONFIG_FILE="/etc/ssh/sshd_config.d/99-vps-security.conf"


# ============================================================
# Logging
# ============================================================

log() {
    echo "[vps-setup] $*"
}


# ============================================================
# Must run as root
# ============================================================

if [[ "${EUID}" -ne 0 ]]; then
    echo "ERROR: This script must run as root."
    exit 1
fi


# ============================================================
# Create user
# ============================================================

if id "${USER_NAME}" >/dev/null 2>&1; then

    log "User ${USER_NAME} already exists."

else

    log "Creating user ${USER_NAME}..."

    useradd \
        --create-home \
        --shell /bin/bash \
        "${USER_NAME}"

fi


# ============================================================
# Add user to sudo group
# ============================================================

log "Adding ${USER_NAME} to sudo group..."

usermod -aG sudo "${USER_NAME}"


# ============================================================
# Configure passwordless sudo
# ============================================================

log "Configuring passwordless sudo..."

cat > "${SUDOERS_FILE}" <<EOF
${USER_NAME} ALL=(ALL:ALL) NOPASSWD: ALL
EOF

chmod 0440 "${SUDOERS_FILE}"


# ============================================================
# Validate sudoers
# ============================================================

if ! visudo -cf "${SUDOERS_FILE}"; then

    log "ERROR: Invalid sudoers configuration."

    rm -f "${SUDOERS_FILE}"

    exit 1

fi


# ============================================================
# Prepare SSH directory
# ============================================================

log "Preparing SSH directory..."

install \
    -d \
    -m 700 \
    -o "${USER_NAME}" \
    -g "${USER_NAME}" \
    "${USER_HOME}/.ssh"


# ============================================================
# Configure SSH key
# ============================================================

SSH_KEY_READY=false


if [[ -s /root/.ssh/authorized_keys ]]; then

    log "Copying root authorized_keys to ${USER_NAME}..."

    cp \
        /root/.ssh/authorized_keys \
        "${USER_HOME}/.ssh/authorized_keys"

    chown \
        "${USER_NAME}:${USER_NAME}" \
        "${USER_HOME}/.ssh/authorized_keys"

    chmod \
        600 \
        "${USER_HOME}/.ssh/authorized_keys"

    SSH_KEY_READY=true


elif [[ -s "${USER_HOME}/.ssh/authorized_keys" ]]; then

    log "${USER_NAME} already has authorized_keys."

    SSH_KEY_READY=true


else

    log "WARNING: No SSH public key found."

    log "Root SSH login will remain enabled to prevent lockout."

fi


# ============================================================
# Disable password for admin user
# ============================================================

passwd -l "${USER_NAME}" >/dev/null 2>&1 || true


# ============================================================
# SSH hardening
#
# Root SSH login is disabled only when the new user
# has a usable authorized_keys file.
# ============================================================

if [[ "${SSH_KEY_READY}" == "true" ]]; then

    log "Configuring SSH security..."

    cat > "${SSH_CONFIG_FILE}" <<EOF
# Managed by VPS setup script

PermitRootLogin no
PubkeyAuthentication yes
PasswordAuthentication no
KbdInteractiveAuthentication no
EOF


    if sshd -t; then

        log "SSH configuration is valid."

        if systemctl is-active --quiet ssh; then
            systemctl reload ssh
        fi

    else

        log "ERROR: Invalid SSH configuration."

        rm -f "${SSH_CONFIG_FILE}"

        exit 1

    fi

fi


# ============================================================
# Finished
# ============================================================

log "================================================"
log "VPS user setup completed."
log ""
log "User: ${USER_NAME}"
log "Home: ${USER_HOME}"
log "Passwordless sudo: enabled"
log "SSH key available: ${SSH_KEY_READY}"
log ""
log "IMPORTANT:"
log "Keep the current root session open."
log "Open another terminal and test SSH using:"
log ""
log "ssh ${USER_NAME}@SERVER_IP"
log "================================================"
```

---

# 5. Chọn username

Trước khi chạy script, chỉnh:

```bash
USER_NAME="iotstack"
```

`iotstack` chỉ là username mẫu.

Có thể đổi thành:

```bash
USER_NAME="deploy"
```

hoặc:

```bash
USER_NAME="ops"
```

hoặc:

```bash
USER_NAME="platform"
```

Không cần sửa các phần còn lại.

Script sử dụng:

```bash
USER_HOME="/home/${USER_NAME}"
```

và:

```bash
SUDOERS_FILE="/etc/sudoers.d/90-${USER_NAME}"
```

nên mọi đường dẫn sẽ tự thay đổi.

Ví dụ:

```bash
USER_NAME="deploy"
```

sẽ tương ứng với:

```text
/home/deploy
/etc/sudoers.d/90-deploy
```

---

# 6. Cấp quyền thực thi

Chạy:

```bash
chmod 700 /root/setup-vps-user.sh
```

Kiểm tra:

```bash
ls -l /root/setup-vps-user.sh
```

Kết quả tương tự:

```text
-rwx------ 1 root root ... /root/setup-vps-user.sh
```

---

# 7. Chạy script

Thực hiện:

```bash
/root/setup-vps-user.sh
```

Hoặc:

```bash
bash /root/setup-vps-user.sh
```

Script sẽ thực hiện:

```text
Create user
    ↓
Add sudo group
    ↓
Configure NOPASSWD
    ↓
Validate sudoers
    ↓
Create ~/.ssh
    ↓
Copy authorized_keys
    ↓
Set ownership + permissions
    ↓
Lock password login
    ↓
Configure SSH security
    ↓
Validate sshd
    ↓
Disable root SSH nếu SSH key đã sẵn sàng
```

Kết quả thành công tương tự:

```text
[vps-setup] ================================================
[vps-setup] VPS user setup completed.

[vps-setup] User: iotstack
[vps-setup] Home: /home/iotstack
[vps-setup] Passwordless sudo: enabled
[vps-setup] SSH key available: true
```

---

# 8. Không đóng root session hiện tại

Sau khi script chạy xong, giữ nguyên terminal root đang mở.

Mở một terminal khác để kiểm tra user mới:

```bash
ssh iotstack@SERVER_IP
```

Nếu đã đổi username:

```bash
ssh deploy@SERVER_IP
```

Chỉ đóng root session cũ sau khi xác nhận toàn bộ các bước kiểm tra phía dưới thành công.

---

# 9. Kiểm tra user mới

Sau khi SSH bằng user mới:

```bash
whoami
```

Kết quả:

```text
iotstack
```

Kiểm tra user và group:

```bash
id
```

Kết quả tương tự:

```text
uid=1001(iotstack)
gid=1001(iotstack)
groups=1001(iotstack),27(sudo)
```

Hoặc:

```bash
id iotstack
```

---

# 10. Kiểm tra SSH key

Kiểm tra:

```bash
ls -la ~/.ssh
```

Phải có:

```text
authorized_keys
```

Kiểm tra thư mục:

```bash
stat ~/.ssh
```

Permission nên là:

```text
0700
```

Kiểm tra file:

```bash
stat ~/.ssh/authorized_keys
```

Permission nên là:

```text
0600
```

Owner phải tương ứng với user mới.

Ví dụ:

```text
iotstack:iotstack
```

Có thể kiểm tra nhanh:

```bash
ls -ld ~/.ssh
ls -l ~/.ssh/authorized_keys
```

---

# 11. Kiểm tra sudo không cần password

Chạy:

```bash
sudo whoami
```

Kết quả phải là:

```text
root
```

và không yêu cầu password.

Kiểm tra non-interactive:

```bash
sudo -n true && echo "Passwordless sudo OK"
```

Kết quả:

```text
Passwordless sudo OK
```

Kiểm tra danh sách quyền:

```bash
sudo -l
```

Phải có nội dung tương tự:

```text
(ALL : ALL) NOPASSWD: ALL
```

---

# 12. Kiểm tra cấu hình SSH

Kiểm tra root SSH:

```bash
sudo sshd -T | grep permitrootlogin
```

Kết quả mong đợi:

```text
permitrootlogin no
```

Kiểm tra password authentication:

```bash
sudo sshd -T | grep passwordauthentication
```

Kết quả:

```text
passwordauthentication no
```

Kiểm tra public key authentication:

```bash
sudo sshd -T | grep pubkeyauthentication
```

Kết quả:

```text
pubkeyauthentication yes
```

---

# 13. Kiểm tra root SSH đã bị disable

Sau khi user mới hoạt động bình thường, có thể thử từ terminal khác:

```bash
ssh root@SERVER_IP
```

SSH server phải từ chối đăng nhập root.

Trong khi:

```bash
ssh iotstack@SERVER_IP
```

vẫn phải hoạt động bình thường.

---

# 14. Cơ chế tránh tự khóa khỏi VPS

Script không disable root SSH một cách vô điều kiện.

Nó kiểm tra xem có SSH key hay không.

Nếu tồn tại:

```text
/root/.ssh/authorized_keys
```

script copy sang:

```text
/home/<USER_NAME>/.ssh/authorized_keys
```

sau đó mới cấu hình:

```text
PermitRootLogin no
```

Luồng xử lý:

```text
Có SSH public key?
       │
       ├── 🔴 Không
       │      │
       │      └── giữ root SSH
       │
       └── ✅ Có
              │
              ├── copy authorized_keys
              ├── set owner
              ├── set permissions
              ├── validate sshd
              └── disable root SSH
```

Nếu không tìm thấy key:

```text
WARNING: No SSH public key found.
Root SSH login will remain enabled to prevent lockout.
```

Nhờ đó server không tự disable đường truy cập root trong trường hợp user mới chưa thể SSH.

---

# 15. Trường hợp VPS đang dùng password thay vì SSH key

Nếu VPS mới chỉ cho phép:

```bash
ssh root@SERVER_IP
```

bằng password và chưa có:

```text
/root/.ssh/authorized_keys
```

nên cấu hình SSH key trước.

Trên máy local, tạo **key riêng cho VPS này** thay vì dùng chung `id_ed25519` mặc định — dễ thu hồi/xoay vòng sau này mà không ảnh hưởng các server khác:

```bash
ssh-keygen -t ed25519 -C "iotstack" -f ~/.ssh/iotstack_ed25519
```

Sẽ tạo ra:

```text
~/.ssh/iotstack_ed25519       (private key)
~/.ssh/iotstack_ed25519.pub   (public key)
```

Nếu đã có key riêng cho VPS này rồi thì không cần tạo lại.

Copy key (dùng `-i` để chỉ đúng key vừa tạo):

```bash
ssh-copy-id -i ~/.ssh/iotstack_ed25519.pub iotstack@SERVER_IP
```

Sau đó kiểm tra trên VPS:

```bash
cat /home/iotstack/.ssh/authorized_keys
```

Vì key không nằm ở đường dẫn mặc định, từ bước này trở đi khi SSH vào user mới cần chỉ định `-i`:

```bash
ssh -i ~/.ssh/iotstack_ed25519 iotstack@SERVER_IP
```

Hoặc tiện hơn, khai báo alias trong `~/.ssh/config` trên máy local để không phải gõ `-i` mỗi lần:

```text
Host iotstack-vps
    HostName SERVER_IP
    User iotstack
    IdentityFile ~/.ssh/iotstack_ed25519
```

Từ đó chỉ cần:

```bash
ssh iotstack-vps
```

---

# 16. Script có thể chạy lại

Script được thiết kế để có thể chạy lại trong phần lớn trường hợp.

Nếu user đã tồn tại:

```text
User iotstack already exists.
```

script sẽ không tạo user lần nữa.

Các phần sau vẫn được kiểm tra hoặc cập nhật:

```text
sudo group
sudoers
SSH directory
authorized_keys
permissions
SSH configuration
```

Tuy nhiên, với VPS đang chạy production, nên đọc kỹ script trước khi chạy lại nếu đã có các thay đổi SSH tùy chỉnh khác.

---

# 17. Sau khi setup thành công

Khi đã xác nhận:

```text
✅ SSH user mới hoạt động
✅ SSH key hoạt động
✅ sudo hoạt động
✅ sudo không cần password
✅ root SSH đã disable
```

có thể thoát khỏi root session cũ.

Từ thời điểm này sử dụng:

```bash
ssh iotstack@SERVER_IP
```

hoặc:

```bash
ssh <USER_NAME>@SERVER_IP
```

Khi cần quyền hệ thống:

```bash
sudo <command>
```

Ví dụ:

```bash
sudo apt update
sudo apt upgrade
sudo systemctl status ssh
sudo journalctl -xe
```

---

# 18. Có nên xóa script sau khi setup?

Script chỉ phục vụ bước bootstrap ban đầu nên không bắt buộc phải giữ.

Sau khi setup hoàn tất có thể xóa:

```bash
sudo rm /root/setup-vps-user.sh
```

Hoặc giữ lại nếu muốn sử dụng để kiểm tra hoặc tái cấu hình.

Nếu giữ script, permission:

```text
700
```

đảm bảo chỉ `root` có thể đọc và thực thi.

---

# 19. Quy trình setup VPS hoàn chỉnh

```text
VPS mới
   │
   ▼
SSH root tạm thời
   │
   ▼
Kiểm tra SSH public key
   │
   ▼
Tạo setup-vps-user.sh
   │
   ▼
Chọn USER_NAME
   │
   ▼
chmod 700 script
   │
   ▼
Chạy script thủ công
   │
   ├── ✅ Create user
   ├── ✅ Add sudo
   ├── ✅ Configure NOPASSWD
   ├── ✅ Validate sudoers
   ├── ✅ Copy SSH key
   ├── ✅ Set permissions
   ├── ✅ Validate sshd
   └── ✅ Disable root SSH
   │
   ▼
⚠️ Giữ root terminal hiện tại
   │
   ▼
Mở terminal mới
   │
   ▼
ssh <USER_NAME>@SERVER_IP
   │
   ▼
Test SSH
   │
   ▼
Test sudo
   │
   ▼
Test root SSH disabled
   │
   ▼
✅ Hoàn tất
```

Kết quả cuối cùng:

```text
❌ Không dùng:

ssh root@SERVER_IP


✅ Sử dụng:

ssh <USER_NAME>@SERVER_IP


✅ Khi cần quyền hệ thống:

sudo <command>
```

`iotstack` trong tài liệu chỉ là username mẫu để giúp dễ nhận biết user quản trị và mục đích của VPS. Người sử dụng có thể đổi thành bất kỳ username nào phù hợp với quy ước hạ tầng của mình.