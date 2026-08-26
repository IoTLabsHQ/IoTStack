// Hand-maintained — small enough at this count that auto-discovery buys
// nothing. Add an entry here whenever a new numbered doc is added under
// docs/<group>/<num>_<slug>.<lang>.md.
export const DOC_GROUPS = [
  {
    group: "deployment",
    groupLabel: { en: "Deployment", vi: "Triển khai" },
    docs: [
      {
        slug: "server-requirements",
        num: "001",
        title: { en: "Server requirements", vi: "Yêu cầu server" },
      },
      {
        slug: "installer",
        num: "002",
        title: { en: "One-command installer", vi: "Cài đặt bằng một lệnh" },
      },
      {
        slug: "manual-vps-setup",
        num: "003",
        title: { en: "Manual VPS setup", vi: "Cài đặt VPS thủ công" },
      },
      {
        slug: "vps-admin-user",
        num: "004",
        title: { en: "VPS admin user setup", vi: "Tạo user quản trị VPS" },
      },
    ],
  },
  {
    group: "reference",
    groupLabel: { en: "Reference", vi: "Tài liệu tham khảo" },
    docs: [
      { slug: "architecture", num: "001", title: { en: "Architecture", vi: "Kiến trúc" } },
      { slug: "security", num: "002", title: { en: "Security", vi: "Bảo mật" } },
    ],
  },
] as const;
