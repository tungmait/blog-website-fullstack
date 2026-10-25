# Blogify

Website blog hoàn chỉnh với Node.js + Express + SQLite.

## Tính năng

- Trang chủ hiển thị bài viết mới nhất
- Chi tiết bài viết theo ID
- Phân loại theo danh mục
- Trang quản trị để tạo, sửa, xóa bài viết
- Cơ sở dữ liệu SQLite tích hợp sẵn
- Responsive CSS cho mobile và desktop

## Công nghệ

- Node.js
- Express
- EJS
- SQLite3

## Cài đặt

1. Clone repo
2. Cài đặt dependencies:
   ```bash
   npm install
   ```
3. Chạy ứng dụng:
   ```bash
   npm start
   ```
4. Mở trình duyệt tại:
   ```bash
   http://localhost:3000
   ```

## Cấu trúc thư mục

- `server.js` - server chính
- `data/` - nơi chứa database SQLite
- `public/` - file tĩnh (CSS)
- `views/` - template EJS

## Quản trị

- Truy cập `/admin`
- Tạo, chỉnh sửa hoặc xóa bài viết

## Ghi chú

Database sẽ tự động khởi tạo khi chạy lần đầu tiên.
