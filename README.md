# Blogify

Website blog hoàn chỉnh với Node.js + Express + Firebase Firestore.

## Tính năng

- Trang chủ hiển thị bài viết mới nhất
- Chi tiết bài viết theo ID
- Phân loại theo danh mục
- Trang quản trị để tạo, sửa, xóa bài viết
- Cơ sở dữ liệu Firebase Firestore, tự tạo collection và dữ liệu mẫu
- Responsive CSS cho mobile và desktop

## Công nghệ

- Node.js
- Express
- EJS
- Firebase Admin SDK và Firestore
- Vercel (tùy chọn triển khai)

## Cài đặt

1. Clone repo
2. Tạo Firebase project, bật Cloud Firestore ở chế độ Native, rồi tạo service account tại Project settings → Service accounts.
3. Sao chép cấu hình:
   ```bash
   cp .env.example .env
   ```
   Điền các giá trị Firebase và dán JSON service account vào `FIREBASE_SERVICE_ACCOUNT` trên một dòng. Không commit `.env` hoặc chia sẻ service account này.
4. Cài đặt dependencies:
   ```bash
   npm install
   ```
5. Chạy ứng dụng:
   ```bash
   npm start
   ```
6. Mở trình duyệt tại:
   ```bash
   http://localhost:3000
   ```

## Cấu trúc thư mục

- `server.js` - server chính
- Dữ liệu nằm trên Firestore; các collection được tạo khi ứng dụng thêm tài liệu đầu tiên.
- `public/` - file tĩnh (CSS)
- `views/` - template EJS

## Quản trị

- Truy cập `/admin`
- Tạo, chỉnh sửa hoặc xóa bài viết

## Ghi chú

Khi chạy lần đầu tiên, ứng dụng tạo các collection `categories` và `posts` cùng dữ liệu mẫu nếu chúng đang trống. Firebase Admin SDK truy cập Firestore bằng service account; Firestore Security Rules không thay thế việc bảo vệ các route quản trị.

## Cấu hình Firebase

1. Tạo project tại https://console.firebase.google.com/ và bật Firestore Database ở chế độ Native.
2. Lấy các giá trị web app trong Project settings → General để điền `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID` và `FIREBASE_APP_ID`.
3. Tạo service account tại Project settings → Service accounts, tải JSON và đặt nội dung đó vào `FIREBASE_SERVICE_ACCOUNT`. Backend chỉ dùng service account; không đưa credential này vào client-side code.
4. Chạy `npm install && npm start`. Firestore lưu collection `categories` (`id`, `name`, `slug`) và `posts` (`id`, `title`, `slug`, `excerpt`, `content`, `author`, `category_id`, `is_published`, `created_at`, `updated_at`).

## Triển khai trên Vercel

1. Import repository này vào Vercel; `vercel.json` sẽ định tuyến các yêu cầu đến Express.
2. Thêm các biến Firebase cần thiết trong Project → Settings → Environment Variables. Đặt toàn bộ service account JSON vào `FIREBASE_SERVICE_ACCOUNT`.
3. Deploy. Vercel chạy ứng dụng dạng serverless và kết nối tới cùng Firestore database.
4. Các route `/admin` hiện không có xác thực. Bảo vệ chúng trước khi triển khai website công khai.
