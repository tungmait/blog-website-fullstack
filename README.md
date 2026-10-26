# Blogify

Website blog hoàn chỉnh với Node.js + Express + Appwrite.

## Tính năng

- Trang chủ hiển thị bài viết mới nhất
- Chi tiết bài viết theo ID
- Phân loại theo danh mục
- Trang quản trị để tạo, sửa, xóa bài viết
- Cơ sở dữ liệu Appwrite (Cloud/Education), tự tạo collection và dữ liệu mẫu
- Responsive CSS cho mobile và desktop

## Công nghệ

- Node.js
- Express
- EJS
- Appwrite (node-appwrite SDK)

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
- `data/` - (không còn dùng; dữ liệu nằm trên Appwrite)
- `public/` - file tĩnh (CSS)
- `views/` - template EJS

## Quản trị

- Truy cập `/admin`
- Tạo, chỉnh sửa hoặc xóa bài viết

## Ghi chú

Database sẽ tự động khởi tạo khi chạy lần đầu tiên.

## Cấu hình Appwrite

1. Tạo project tại https://cloud.appwrite.io (Appwrite Education qua GitHub Student Pack).
2. Tạo API key (scope databases, collections, attributes, documents: read/write) và một Database.
3. `cp .env.example .env` rồi điền `APPWRITE_PROJECT_ID`, `APPWRITE_API_KEY`, `APPWRITE_DATABASE_ID`.
4. `npm install && npm start` - collection `categories` (name, slug) và `posts`
   (title, slug, excerpt, content, author, category_id, is_published, created_at, updated_at)
   cùng dữ liệu mẫu được tạo tự động ở lần chạy đầu tiên.
