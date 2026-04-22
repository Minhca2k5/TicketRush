1. Mục tiêu
Xây dựng TicketRush theo kiến trúc microservices với: - Backend: Spring Boot
- Frontend: React.js
- Nhóm: 3 người (mỗi người đều làm cả backend và frontend)
- Deadline demo/vấn đáp: 11/05/2026 - 16/05/2026
Roadmap này được tối ưu cho giai đoạn từ 13/04/2026 đến 10/05/2026 , sau đó dành 1 tuần để demo, fix lỗi và chuẩn bị thuyết minh sản phẩm . 2. Kiến trúc đề xuất
2.1. Microservices tối thiểu 1. API Gateway
- Định tuyến request từ frontend vào các service
- Có thể kiểm soát auth token ở tầng gateway nếu cần
2. Auth Service
- Đăng ký, đăng nhập, JWT
- Phân quyền: CUSTOMER, ADMIN
- Quản lý profile (tuổi, giới tính phục vụ thống kê)
3. Event Service
- Quản lý sự kiện, khu vực, sơ đồ ghế , giá vé
- Trả dữ liệu cho trang danh sách sự kiện và chi tiết sự kiện
4. Booking Service
- Xử lý giữ ghế , locking, transaction, checkout, vé điện tử
- Quản lý vòng đời ghế :
o AVAILABLE → LOCKED → SOLD / RELEASED - Background job: tự động release lock hết hạn
5. Queue Service

- Virtual queue / waiting room
- Cấp quyền vào màn hình đặt ghế theo từng đợt
6. Dashboard Service (hoặc gộp nhẹ vào Event Service)
- Thống kê doanh thu, tỷ lệ lấp đầy
- Thống kê theo tuổi/giới tính
- Nếu thiếu thời gian: có thể để aggregation trong booking - service
2.2. Hạ tầng chung - Database: Dùng chung PostgreSQL với schema tách biệt cho đơn giản
- Message Broker: Bỏ qua, dùng scheduler + DB polling
- Realtime: Polling fallback trước, WebSocket nếu dư thời gian
- DevOps: Docker Compose cho local dev
2.3. Công nghệ gợi ý Backend: - Spring Boot
- Spring Security
- Spring Data JPA
- PostgreSQL
- Flyway
- WebSocket
Frontend: - React.js + Vite
- React Router
- Axios
- Zustand / Redux Toolkit

- Tailwind CSS / Material UI
DevOps local: - Docker Compose (PostgreSQL, Redis nếu cần queue tạm)
3. Nguyên tắc chia việc
Mỗi thành viên gồm: - 1 cụm backend chính
- 1 cụm frontend chính
- 1 phần review/integration chéo
Quy ước vai trò: - Người 1: Auth + Gateway + FE Admin
- Người 2: Event/Seat Map + FE Customer
- Người 3: Booking/Queue + FE Realtime/Checkout
Mỗi tuần đều có task full - stack, không chia cứng backend/frontend. 4. Mục tiêu theo tuần
Tuần 1: 13/04/2026 - 19/04/2026 Mục tiêu - Chốt architecture
- Dựng skeleton frontend/backend
- Chốt database design
- Có luồng đăng nhập + danh sách sự kiện mẫu
Việc chung - Chốt domain model:
o User, Event, SeatSection, Seat, SeatLock, Order, Ticket, QueueEntry

- Thiết kế sequence:
o Xem sự kiện o Giữ ghế o Hết hạn lock o Checkout o Waiting room - Tạo cấu trúc monorepo trong repo chính:
o eventhaven - ui/ o event - service/ o auth - service/ o booking - service/ o api - gateway/ o queue - service/ - Chốt convention: branch, commit, API format, error format
Người 1 Backend - Khởi tạo auth - service
- User schema + JWT + role ADMIN/CUSTOMER
- Khởi tạo API Gateway routing
Frontend - React app skeleton
- Routing + layout
- Login/Register UI + gọi API
Kết quả - Login thành công
- Lưu token

- Route guard cơ bản
Người 2 Backend - Khởi tạo event - service
- Schema Event, VenueZone, Seat, PriceTier
- CRUD event + lấy sơ đồ ghế
Frontend - Home + danh sách event
- Event detail
- Seat map static (mock)
Kết quả - Admin tạo event mock
- Customer xem event + seat map mock
Người 3 Backend - booking - service + queue - service skeleton
- Schema SeatLock, Order, Ticket, QueueEntry
- Flow lock/release chuẩn bị
Frontend - Waiting room UI
- Checkout mock
- Order success mock
- State quản lý ghế
Kết quả - UI checkout + waiting room mock hoạt động

Milestone Tuần 1 - Login chạy được
- Danh sách sự kiện hiển thị
- Seat map tĩnh hiển thị
- Tất cả service chạy qua gateway
Tuần 2: 20/04/2026 - 26/04/2026 Mục tiêu - Hoàn thiện seat selection cơ bản
- Locking đơn giản (không cần concurrency cao ngay)
- Admin tạo seat matrix
Việc chung - Chốt locking strategy cơ bản (dùng DB lock hoặc optimistic locking)
- Test manual locking
- Chốt API contract frontend/backend
Người 1 Backend - Auth filter gateway hoàn chỉnh
- Profile API
- Logging + error handling + trace ID
Frontend - Admin login hoàn chỉnh

- Role - based routing
- Admin dashboard shell
Người 2 Backend - API tạo event + zone + seat matrix
- API seat map theo trạng thái
Frontend - Admin tạo sơ đồ ghế
- Seat map interactive (click/hover/legend)
Người 3 Backend - API lock seat
- Transaction + row locking
- Release seat + checkout mock
Frontend - Seat selection UI connect API
- Countdown 10 phút checkout
Milestone - Chọn ghế thật hoạt động
- Demo concurrency (tranh chấp ghế )
- Admin tạo event + seat matrix
Tuần 3: 27/04/2026 - 03/05/2026 Mục tiêu

- Ticket lifecycle hoàn chỉnh (checkout + QR)
- Realtime update cơ bản (polling)
- Dashboard tối thiểu
Việc chung - Chốt realtime: Polling 5s fallback, WebSocket nếu dư thời gian
- Scheduler release lock 30s
- Seed data
Người 1 Backend - Profile mở rộng (tuổi, giới tính)
- API cho dashboard
Frontend - Profile UI
- Dashboard admin layout
Người 2 Backend - Tối ưu seat API
- Hỗ trợ realtime/polling
Frontend - Realtime seat map
- Update trạng thái ghế

Người 3 Backend - Checkout → SOLD
- Scheduler release lock
- QR ticket generation
Frontend - Checkout UI hoàn chỉnh
- QR code hiển thị
- Danh sách vé
Milestone - Full flow:
o chọn ghế → lock → checkout → QR ticket - Realtime seat update hoạt động
Tuần 4: 04/05/2026 - 10/05/2026 Mục tiêu - Virtual queue cơ bản (nếu kịp)
- Dashboard hoàn chỉnh
- Test & fix bug
Việc chung - Xác định điều kiện vào waiting room (nếu implement queue)
- Test concurrency nhẹ
- Fix UI/UX
- Freeze scope

Người 1 Backend - Gateway + queue integration
Frontend - Flow waiting room → booking
Người 2 Backend - Dashboard API:
o doanh thu o tỷ lệ lấp đầy o nhân khẩu học Frontend - Dashboard charts
- Optimize seat map UI
Người 3 Backend - Queue service hoàn chỉnh
- Batch entry + position tracking
Frontend - Waiting room realtime/polling
Milestone - Virtual queue hoạt động
- Dashboard chạy dữ liệu thật
- Full system ổn định

Tuần 5: 11/05/2026 - 16/05/2026 Mục tiêu - Fix bug cuối
- Chuẩn bị demo & vấn đáp
Việc chung - Script demo 7 – 10 phút:
1. Admin tạo event
2. Customer vào waiting room
3. Chọn ghế
4. Tranh chấp ghế
5. Checkout + QR
6. Dashboard admin
- Chuẩn bị câu hỏi:
o Microservices là gì? o Locking xử lý race condition thế nào? o Vì sao WebSocket/polling? o Virtual queue hoạt động ra sao? Người 1 - Fix auth/gateway
- Chuẩn bị kiến trúc tổng quan
Người 2 - Fix event/seat map/dashboard
- Chuẩn bị demo admin
Người 3

- Fix booking/queue/checkout
- Giải thích concurrency + lock + scheduler
5. Phân chia ownership
Người 1 - Auth service
- API Gateway
- Login/Register
- Route guard
- Admin layout
Người 2 - Event service
- Seat map UI
- Event detail
- Dashboard UI
Người 3 - Booking service
- Queue service
- Checkout
- Waiting room UI
6. Tính năng theo ưu tiên
P0 (bắt buộc cho demo) - Login/Register + role
- Admin tạo event + seat matrix
- Xem seat map
- Lock seat không trùng
- Checkout + ticket
- Release lock timeout
- QR ticket
P1 (nên có nếu kịp) - Realtime update (polling)
- Virtual queue cơ bản
- Dashboard với thống kê cơ bản
- Seed data đẹp
- Logging tốt
P2 (nếu còn thời gian) - Email
- Lịch sử đơn
- Search nâng cao
- UI mobile
- WebSocket realtime
7. Definition of Done
Một task hoàn thành khi: - Code backend + frontend xong
- Test local OK
- Merge main branch
- Có data demo
- Có review từ ít nhất 1 người
8. Lịch họp
- Thứ 2: chốt task
- Thứ 5: sync tiến độ
- Chủ nhật: demo nội bộ

9. Rủi ro
Rủi ro 1: Kiến trúc hybrid vẫn phức tạp → Fallback to full monolith nếu cần Rủi ro 2: Locking + concurrency khó → Test manual trước, stress test sau Rủi ro 3: Realtime/Queue không kịp → Ưu tiên polling thay WebSocket, bỏ queue nếu thiếu thời gian 10. Kịch bản demo
1. Admin tạo event
2. 2 customer vào cùng lúc
3. Tranh chấp ghế VIP - A1
4. Chỉ 1 người lock thành công
5. Checkout + QR ticket
6. Waiting room nếu bị queue
7. Dashboard hiển thị doanh thu