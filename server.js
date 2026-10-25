const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'blog.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Database connection error:', err.message);
  } else {
    console.log('Connected to SQLite database at', DB_PATH);
  }
});

const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, changes: this.changes });
    });
  });

const dbGet = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });

const dbAll = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'post';
}

async function ensureUniqueSlug(baseTitle, excludeId = null) {
  let slug = slugify(baseTitle);
  let index = 2;

  while (true) {
    const exists = await dbGet(
      'SELECT id FROM posts WHERE slug = ? AND (? IS NULL OR id != ?)',
      [slug, excludeId, excludeId]
    );

    if (!exists) return slug;
    slug = `${slugify(baseTitle)}-${index}`;
    index += 1;
  }
}

async function getCategories() {
  return dbAll('SELECT * FROM categories ORDER BY name ASC');
}

async function getPublishedPosts() {
  return dbAll(`
    SELECT p.*, c.name AS category_name
    FROM posts p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.is_published = 1
    ORDER BY p.created_at DESC
  `);
}

async function getPostById(id) {
  return dbGet(
    `
      SELECT p.*, c.name AS category_name
      FROM posts p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `,
    [id]
  );
}

async function getPostsByCategory(categoryId) {
  return dbAll(
    `
      SELECT p.*, c.name AS category_name
      FROM posts p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.category_id = ? AND p.is_published = 1
      ORDER BY p.created_at DESC
    `,
    [categoryId]
  );
}

async function initDatabase() {
  await dbRun(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      excerpt TEXT,
      content TEXT NOT NULL,
      author TEXT DEFAULT 'Admin',
      category_id INTEGER,
      is_published INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(category_id) REFERENCES categories(id)
    )
  `);

  const categoryCount = await dbGet('SELECT COUNT(*) AS count FROM categories');
  if (categoryCount.count === 0) {
    const defaultCategories = [
      ['Frontend', 'frontend'],
      ['Backend', 'backend'],
      ['UI/UX', 'ui-ux'],
      ['Productivity', 'productivity']
    ];

    for (const [name, slug] of defaultCategories) {
      await dbRun('INSERT INTO categories (name, slug) VALUES (?, ?)', [name, slug]);
    }
  }

  const postCount = await dbGet('SELECT COUNT(*) AS count FROM posts');
  if (postCount.count === 0) {
    const categories = await getCategories();
    const bySlug = (slug) => categories.find((category) => category.slug === slug)?.id;

    const samplePosts = [
      {
        title: 'Cách xây dựng giao diện blog đẹp và tối ưu UX',
        excerpt: 'Hướng dẫn tạo blog dễ đọc và thân thiện trên nhiều thiết bị.',
        content: '# Cách xây dựng giao diện blog đẹp và tối ưu UX\n\n- Thiết kế rõ ràng, tối giản\n- Dùng khoảng cách hợp lý\n- Tạo tiêu đề dễ đọc\n- Tận dụng bố cục mobile-first\n\nMột blog hiệu quả không chỉ là đẹp, mà còn khiến người đọc dễ tập trung vào nội dung.',
        author: 'Tùng Mãi',
        category_id: bySlug('ui-ux'),
        is_published: 1,
      },
      {
        title: 'Node.js và Express cho ứng dụng blog nhanh gọn',
        excerpt: 'Tại sao Express vẫn là lựa chọn phổ biến cho ứng dụng web nhỏ và vừa.',
        content: '# Node.js và Express cho ứng dụng blog nhanh gọn\n\nExpress giúp bạn xây dựng ứng dụng web rất nhanh.\n\nƯu điểm:\n- Route rõ ràng\n- Dễ tích hợp SQLite\n- Phù hợp với dự án nhỏ, vừa',
        author: 'Tùng Mãi',
        category_id: bySlug('backend'),
        is_published: 1,
      },
      {
        title: 'Responsive web design là gì và vì sao quan trọng?',
        excerpt: 'Responsive giúp website hiển thị tốt trên điện thoại, tablet và desktop.',
        content: '# Responsive web design là gì?\n\nResponsive web design là cách thiết kế website thích ứng với nhiều kích thước màn hình.\n\n- Màn hình điện thoại: bố cục một cột\n- Máy tính bảng: bố cục 2 cột\n- Desktop: bố cục nhiều cột',
        author: 'Tùng Mãi',
        category_id: bySlug('frontend'),
        is_published: 1,
      },
      {
        title: '7 thói quen giúp làm việc hiệu quả hơn mỗi ngày',
        excerpt: 'Một số thói quen nhỏ nhưng mang lại hiệu quả lớn trong công việc.',
        content: '# 7 thói quen giúp làm việc hiệu quả hơn mỗi ngày\n\n- Ưu tiên công việc quan trọng nhất\n- Chia nhỏ task\n- Tập trung 25 phút rồi nghỉ ngắn\n- Ghi chép tiến độ',
        author: 'Tùng Mãi',
        category_id: bySlug('productivity'),
        is_published: 1,
      }
    ];

    for (const post of samplePosts) {
      const slug = await ensureUniqueSlug(post.title);
      await dbRun(
        `INSERT INTO posts (title, slug, excerpt, content, author, category_id, is_published) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [post.title, slug, post.excerpt, post.content, post.author, post.category_id, post.is_published]
      );
    }
  }
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(async (req, res, next) => {
  try {
    res.locals.categories = await getCategories();
    next();
  } catch (error) {
    next(error);
  }
});

app.get('/', async (req, res) => {
  try {
    const posts = await getPublishedPosts();
    const featured = posts.slice(0, 3);
    res.render('index', { title: 'Trang chủ', posts, featured });
  } catch (error) {
    console.error(error);
    res.status(500).send('Có lỗi xảy ra khi tải trang chủ.');
  }
});

app.get('/about', (req, res) => {
  res.render('about', { title: 'Về Blogify' });
});

app.get('/category/:slug', async (req, res) => {
  try {
    const category = await dbGet('SELECT * FROM categories WHERE slug = ?', [req.params.slug]);
    if (!category) {
      return res.status(404).render('404', { title: 'Không tìm thấy danh mục' });
    }

    const posts = await getPostsByCategory(category.id);
    res.render('category', { title: category.name, category, posts });
  } catch (error) {
    console.error(error);
    res.status(500).send('Có lỗi xảy ra khi tải danh mục.');
  }
});

app.get('/post/:id', async (req, res) => {
  try {
    const post = await getPostById(req.params.id);
    if (!post || post.is_published !== 1) {
      return res.status(404).render('404', { title: 'Bài viết không tồn tại' });
    }

    const relatedPosts = await dbAll(
      `
        SELECT p.*, c.name AS category_name
        FROM posts p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.is_published = 1 AND p.id != ?
        ORDER BY p.created_at DESC
        LIMIT 3
      `,
      [post.id]
    );

    res.render('post', { title: post.title, post, relatedPosts });
  } catch (error) {
    console.error(error);
    res.status(500).send('Có lỗi xảy ra khi tải bài viết.');
  }
});

app.get('/admin', async (req, res) => {
  try {
    const posts = await dbAll(`
      SELECT p.*, c.name AS category_name
      FROM posts p
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY p.created_at DESC
    `);
    res.render('admin', { title: 'Quản trị blog', posts });
  } catch (error) {
    console.error(error);
    res.status(500).send('Không thể tải trang quản trị.');
  }
});

app.get('/admin/new', async (req, res) => {
  try {
    const categories = await getCategories();
    res.render('admin-form', { title: 'Tạo bài viết mới', post: null, categories });
  } catch (error) {
    console.error(error);
    res.status(500).send('Không thể mở form tạo bài viết.');
  }
});

app.get('/admin/edit/:id', async (req, res) => {
  try {
    const post = await getPostById(req.params.id);
    if (!post) {
      return res.status(404).render('404', { title: 'Bài viết không tồn tại' });
    }

    const categories = await getCategories();
    res.render('admin-form', { title: 'Chỉnh sửa bài viết', post, categories });
  } catch (error) {
    console.error(error);
    res.status(500).send('Không thể mở form chỉnh sửa.');
  }
});

app.post('/admin/posts', async (req, res) => {
  try {
    const { title, excerpt, content, author, category_id, is_published } = req.body;

    if (!title || !content || !category_id) {
      return res.status(400).send('Vui lòng điền đầy đủ tiêu đề, nội dung và danh mục.');
    }

    const slug = await ensureUniqueSlug(title);
    await dbRun(
      `INSERT INTO posts (title, slug, excerpt, content, author, category_id, is_published) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title.trim(), slug, excerpt ? excerpt.trim() : '', content.trim(), author ? author.trim() : 'Admin', Number(category_id), is_published === 'on' ? 1 : 0]
    );

    res.redirect('/admin');
  } catch (error) {
    console.error(error);
    res.status(500).send('Không thể lưu bài viết.');
  }
});

app.post('/admin/posts/:id', async (req, res) => {
  try {
    const { title, excerpt, content, author, category_id, is_published } = req.body;
    const id = req.params.id;

    if (!title || !content || !category_id) {
      return res.status(400).send('Vui lòng điền đầy đủ tiêu đề, nội dung và danh mục.');
    }

    const slug = await ensureUniqueSlug(title, Number(id));
    await dbRun(
      `UPDATE posts SET title = ?, slug = ?, excerpt = ?, content = ?, author = ?, category_id = ?, is_published = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [title.trim(), slug, excerpt ? excerpt.trim() : '', content.trim(), author ? author.trim() : 'Admin', Number(category_id), is_published === 'on' ? 1 : 0, Number(id)]
    );

    res.redirect('/admin');
  } catch (error) {
    console.error(error);
    res.status(500).send('Không thể cập nhật bài viết.');
  }
});

app.post('/admin/posts/delete/:id', async (req, res) => {
  try {
    await dbRun('DELETE FROM posts WHERE id = ?', [Number(req.params.id)]);
    res.redirect('/admin');
  } catch (error) {
    console.error(error);
    res.status(500).send('Không thể xóa bài viết.');
  }
});

app.use((req, res) => {
  res.status(404).render('404', { title: 'Trang không tồn tại' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Lỗi máy chủ.');
});

async function startServer() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

startServer();
