# 📊 Phân Tích Dự Án TicketRush — Mức Độ Hoàn Thành & Đề Xuất Tính Năng

## 1. Tổng Quan Mức Độ Hoàn Thành

### Người A — Auth + Gateway + FE Admin

| Tính năng | Trạng thái | Ghi chú |
|-----------|:----------:|---------|
| Auth Service (Register/Login/JWT) | ✅ | Đầy đủ + email verification, role ADMIN/CUSTOMER |
| API Gateway routing | ✅ | Route tất cả services qua gateway |
| JWT Auth Filter ở Gateway | ✅ | `JwtAuthenticationFilter` extract userId |
| Profile API (tuổi, giới tính) | ✅ | GET/PUT `/auth/profile` |
| Admin Dashboard shell | ✅ | Sidebar, metrics cards, event table |
| Route guard / ProtectedRoute | ✅ | Role-based (`requiredRole="ADMIN"`) |
| Login/Register UI | ✅ | Login, Register, VerifyEmail |
| Admin Settings / Users / Reports | ✅ | Có các trang admin utility |
| Email verification (OTP) | ✅ | Resend verification, failed attempts tracking |
| Chatbot (Gemini AI + RAG docs) | ✅ | **BONUS** — RAG từ project docs |
| Logging + Error handling | ✅ | GlobalExceptionHandler, AdminSeeder |

> [!TIP]
> **Người A hoàn thành tốt**, thậm chí vượt scope với chatbot AI + email verification.

---

### Người B — Event/Seat Map + FE Customer + Dashboard

| Tính năng | Trạng thái | Ghi chú |
|-----------|:----------:|---------|
| Event Service CRUD | ✅ | Create event + zone + seat matrix |
| Venue / VenueZone / PriceTier entities | ✅ | Đầy đủ |
| Seat Map API (theo trạng thái) | ✅ | `/api/events/{id}/seats`, seat layout |
| Seat lock/release API | ✅ | Lock + release + purchase endpoints |
| Scheduler release expired locks | ✅ | `SeatLockReleaseScheduler` 60s |
| Dashboard API (revenue, occupancy, demographics) | ✅ | 3 endpoints riêng biệt |
| FE Home + Danh sách event | ✅ | Home, AllEventsPage, HeroSlider |
| FE Event Detail | ✅ | Với waiting room integration |
| FE Seat Map interactive | ✅ | SeatMap, SeatZone, SeatItem, Legend, Stage |
| FE Admin Dashboard Charts | ✅ | Revenue, demographics, account mix |
| Seed Data | ✅ | `SeedDataLoader` |
| Realtime/Polling seat map | ⚠️ | Có polling cơ bản, **chưa có WebSocket** |
| FE Search/Filter events | ✅ | SearchBar component |

> [!TIP]
> **Người B hoàn thành rất tốt**, dashboard có đầy đủ revenue + occupancy + demographics.

---

### Người C — Booking/Queue + FE Checkout/Waiting Room

| Tính năng | Trạng thái | Ghi chú |
|-----------|:----------:|---------|
| Booking Service (lock/release/checkout) | ✅ | Giao tiếp event-service qua REST |
| Order + Ticket entities | ✅ | Order → Tickets (1:N) |
| Transaction + @Transactional | ✅ | Checkout atomicity |
| QR Ticket generation | ✅ | UUID token + QRCodeSVG frontend |
| Queue Service (join/status) | ✅ | Virtual queue polling 3s |
| Batch entry + position tracking | ✅ | Position, estimatedWaitMinutes |
| FE Checkout UI | ✅ | BookingCart, SeatSelector |
| FE Waiting Room realtime/polling | ✅ | 3s polling, auto-admit |
| FE Order History + E-Tickets | ✅ | QR hiển thị, ticket modal |
| Concurrency handling | ⚠️ | REST call → event-service lock, **chưa có explicit PESSIMISTIC_WRITE** ở booking-service |

> [!TIP]
> **Người C hoàn thành đủ scope**, flow checkout → QR ticket hoạt động end-to-end.

---

## 2. Đánh Giá So Với Roadmap

### P0 (Bắt buộc) — ✅ ĐÃ ĐỦ

| Feature | Status |
|---------|:------:|
| Login/Register + role | ✅ |
| Admin tạo event + seat matrix | ✅ |
| Xem seat map | ✅ |
| Lock seat không trùng | ✅ |
| Checkout + ticket | ✅ |
| Release lock timeout | ✅ |
| QR ticket | ✅ |
| Realtime update (polling) | ✅ |

### P1 (Nên có) — ✅ ĐÃ ĐỦ

| Feature | Status |
|---------|:------:|
| Virtual queue | ✅ |
| Dashboard cơ bản | ✅ |
| Seed data | ✅ |
| Logging | ✅ |

### P2 (Nếu còn thời gian)

| Feature | Status |
|---------|:------:|
| Email verification | ✅ |
| Lịch sử đơn (Order History) | ✅ |
| Search nâng cao | ⚠️ Cơ bản |
| UI mobile responsive | ⚠️ Có responsive nhưng chưa tối ưu mobile |

---

## 3. 🚀 Đề Xuất Tính Năng Mới Để Cộng Điểm

> [!IMPORTANT]
> Các tính năng dưới đây tập trung vào **tính năng nghiệp vụ** (business features), dễ demo, gây ấn tượng khi vấn đáp, và **không cần công nghệ phức tạp**.

### 🏆 Tier 1 — Rất dễ cộng điểm, effort vừa phải (1-2 ngày)

#### 1. ⭐ Đánh giá & Bình luận sự kiện (Event Reviews & Ratings)
- Customer sau khi tham dự có thể **đánh giá sao (1-5)** và viết **nhận xét**
- Hiển thị rating trung bình trên trang event
- Admin có thể xem review tổng hợp
- **Tại sao nên làm**: Rất thực tế với hệ thống bán vé, cho thấy hiểu UX, tăng tương tác
- **Ai làm**: Người B (event-service) + Người A (FE)

#### 2. 📧 Gửi email xác nhận đặt vé (Booking Confirmation Email)
- Khi checkout thành công → gửi email chứa **thông tin vé + QR code**
- Tận dụng EmailService có sẵn ở auth-service
- **Tại sao nên làm**: Rất tự nhiên cho hệ thống bán vé, và đã có sẵn infra email
- **Ai làm**: Người C (booking-service) + Người A (email template)

#### 3. 🔔 Hệ thống Thông báo (Notification Center)
- Đã có `NotificationBell.jsx` nhưng chưa kết nối backend
- Thông báo khi: vé được mua thành công, sự kiện sắp diễn ra, ghế bị release
- Lưu notification vào DB, hiển thị danh sách + badge đếm chưa đọc
- **Tại sao nên làm**: Tăng tính professional, rất dễ implement
- **Ai làm**: Người A (backend) + Người C (FE integration)

#### 4. 🎫 Mã giảm giá / Coupon Code
- Admin tạo coupon (VD: `SUMMER20` giảm 20%)
- Customer nhập coupon khi checkout → giảm giá
- Dashboard thống kê mã nào được dùng nhiều
- **Tại sao nên làm**: Feature rất "real-world", dễ demo, thể hiện hiểu e-commerce
- **Ai làm**: Người C (booking logic) + Người B (admin UI)

---

### 🥈 Tier 2 — Gây ấn tượng, effort trung bình (2-3 ngày)

#### 5. 📱 Chia sẻ sự kiện lên MXH (Social Sharing)
- Nút share event lên Facebook, Twitter, copy link
- Hiển thị Open Graph meta tags cho mỗi event
- **Tại sao nên làm**: Dễ implement, rất visual khi demo, thể hiện hiểu SEO
- **Ai làm**: Người B

#### 6. 💝 Yêu thích / Wishlist sự kiện
- Customer có thể "save" sự kiện yêu thích
- Trang riêng xem danh sách đã save
- Thông báo khi sự kiện yêu thích sắp diễn ra hoặc sắp hết vé
- **Tại sao nên làm**: Tăng engagement, rất phổ biến trên các platform thực
- **Ai làm**: Người B (event) + Người A (auth/profile)

#### 7. 📊 Export báo cáo PDF/Excel cho Admin
- Admin export danh sách đơn hàng, doanh thu theo event ra PDF hoặc CSV
- Dùng thư viện phía frontend (jsPDF, SheetJS) hoặc backend
- **Tại sao nên làm**: Feature business-oriented, rất thực tế với admin panel
- **Ai làm**: Người B (dashboard) + Người A (admin FE)

#### 8. 🗺️ Bản đồ vị trí sự kiện (Event Location Map)
- Nhúng Google Maps / Leaflet hiển thị vị trí venue
- Hiển thị trên trang event detail
- **Tại sao nên làm**: Visual rất đẹp, dễ implement với Leaflet (free)
- **Ai làm**: Người B

---

### 🥉 Tier 3 — "Wow factor" nếu có thời gian (3+ ngày)

#### 9. 📈 Realtime Dashboard với WebSocket
- Dashboard admin update realtime khi có đơn mới (không cần F5)
- Seat map update realtime cho customer
- **Tại sao nên làm**: Đã có trong roadmap nhưng chưa implement, thể hiện kỹ thuật cao
- **Ai làm**: Người B + Người C

#### 10. 🎲 Referral / Giới thiệu bạn bè
- Mỗi user có mã referral riêng
- Giới thiệu bạn đăng ký → cả 2 nhận coupon giảm giá
- **Tại sao nên làm**: Rất marketing-oriented, thể hiện hiểu growth hacking
- **Ai làm**: Người A (auth) + Người C (booking)

---

## 4. 🎯 Khuyến Nghị Ưu Tiên

Nếu chỉ có **1-2 ngày** trước vấn đáp, ưu tiên theo thứ tự:

| # | Tính năng | Lý do ưu tiên | Effort |
|---|-----------|---------------|--------|
| 1 | **Notification Center** | Đã có UI sẵn, chỉ cần backend + kết nối | ~4-6h |
| 2 | **Email xác nhận vé** | Đã có EmailService, chỉ cần gọi từ booking | ~4-6h |
| 3 | **Mã giảm giá** | Rất "real-world", dễ demo, gây ấn tượng | ~6-8h |
| 4 | **Event Reviews** | Tăng depth cho hệ thống, dễ implement | ~6-8h |

> [!IMPORTANT]
> **Lời khuyên**: Thay vì làm nhiều tính năng nửa vời, hãy chọn **2-3 tính năng** và implement **hoàn chỉnh** (cả backend + frontend + demo data). Khi vấn đáp, có thể giải thích rõ luồng dữ liệu end-to-end sẽ gây ấn tượng hơn rất nhiều.
