# NEON TEMPEST — Game đối kháng 2D trên trình duyệt

**Tên đề tài:** Xây dựng game đối kháng 2D **NEON TEMPEST**, lấy bối cảnh giải đấu võ thuật ngầm tại Neo-Kyoto theo phong cách cyberpunk neon-noir.

Repo tổng này chứa ba bản triển khai độc lập của cùng đề tài, cùng được quản lý và đẩy lên một remote Git. Yêu cầu chung nằm trong [SPEC.md](SPEC.md).

## Các dự án

| Thư mục | Tên đề tài | Tài liệu chi tiết |
| --- | --- | --- |
| [project-A](project-A/) | NEON TEMPEST — Neo-Kyoto 2099 | [README của project-A](project-A/README.md) |
| [project-B](project-B/) | NEON TEMPEST — Game đối kháng 2D cyberpunk | [README của project-B](project-B/README.md) |
| [project-C](project-C/) | NEON TEMPEST — Game đối kháng 2D cyberpunk | [README của project-C](project-C/README.md) |

Cả ba dự án sử dụng TypeScript, Vite, HTML5 Canvas và Web Audio API. Đồ họa, hiệu ứng và âm thanh được tạo bằng mã nguồn. Dàn nhân vật chung gồm **HAYATE**, **MAGNUS**, **SABLE** và **WARDEN**, với các phong cách chiến đấu khác nhau.

## Chạy một dự án

Sử dụng Node.js 24 và npm. Mỗi dự án có bộ phụ thuộc và lệnh chạy riêng; thực hiện các lệnh sau từ thư mục gốc của repo:

```sh
cd project-A
npm ci
npm start
```

Thay `project-A` bằng `project-B` hoặc `project-C` để chạy bản tương ứng, rồi mở địa chỉ Vite in trong terminal. Các lệnh bên dưới cũng chạy trong thư mục dự án đã chọn:

| Lệnh | Mục đích |
| --- | --- |
| `npm test` | Chạy bộ unit test |
| `npm run build` | Kiểm tra TypeScript và tạo bản build |
| `npx playwright install chromium` | Cài trình duyệt cho kiểm thử E2E |
| `npm run test:e2e` | Chạy kiểm thử E2E bằng Playwright |

Hướng dẫn điều khiển, cơ chế chiến đấu, danh sách chiêu thức, benchmark và báo cáo cân bằng nằm trong README của từng dự án. Ảnh minh họa được lưu trong thư mục `screenshots/` tương ứng.
