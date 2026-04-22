# Kiến trúc dự án TicketRush

## Tổng quan
Dự án TicketRush xây dựng hệ thống đặt vé sự kiện theo kiến trúc microservices với monorepo. Frontend React, backend Spring Boot, database PostgreSQL.

## Kiến trúc chi tiết
- **API Gateway (Spring Cloud Gateway):** Nhận requests từ FE, route dựa trên path (/auth/* → auth-service, /events/* → event-service). Port 8080.
- **Services:**
  - Auth Service (port 8081): Xử lý đăng nhập, JWT, phân quyền.
  - Event Service (port 8082): Quản lý sự kiện, sơ đồ ghế.
  - Booking Service (port 8083): Xử lý giữ ghế, checkout.
  - Queue Service (port 8084): Virtual queue.
  - Dashboard gộp vào Event nếu cần.
- **Database:** PostgreSQL chung, schemas riêng (auth_db, event_db, booking_db). Sử dụng Flyway cho migrations.
- **Tech stack:** Spring Boot 3.x, Spring Security, JPA. FE: React 18 + Vite, Zustand.

## Domain Models (ERD text-based)
- **User:** id (UUID), username (String), password (hashed), email, role (ADMIN/CUSTOMER), age (int), gender (M/F)
- **Event:** id, name, description, start_time, end_time, venue_id
- **VenueZone:** id, event_id, name, price_tier
- **Seat:** id, zone_id, row, number, status (AVAILABLE/LOCKED/SOLD)
- **SeatLock:** id, seat_id, user_id, lock_time, expires_at
- **Order:** id, user_id, total_price, status (PENDING/PAID/CANCELLED)
- **Ticket:** id, order_id, seat_id, qr_code (String)
- **QueueEntry:** id, event_id, user_id, position, entered_at

## Sequence Diagrams (text-based)
### Đăng nhập
User → FE (login form) → POST /auth/login → Auth Service (validate, gen JWT) → Return token → FE store, redirect.

### Xem event
User → FE → GET /events → Event Service (query DB) → Return list + seats → FE render.

### Giữ ghế
User → FE (click seat) → POST /booking/lock → Booking Service (check available, insert SeatLock, expires 10min) → Success/fail → FE update.

### Checkout
User → FE (confirm) → POST /booking/checkout → Booking Service (validate, create Order/Ticket, SOLD, gen QR) → Return ticket → FE show QR.