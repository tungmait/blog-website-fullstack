/*
 * Blogify - Express + EJS blog backed by Appwrite (Appwrite Education / Cloud).
 *
 * Setup:
 *  1. Sign up at https://cloud.appwrite.io (Appwrite Education: apply via the GitHub Student Pack).
 *  2. Create a Project -> copy the Project ID.
 *  3. Project settings -> API keys -> create a key with the scope "databases.read/write"
 *     plus "collections.*" and "attributes.*" (needed for automatic setup).
 *  4. Databases -> Create database -> copy the Database ID.
 *  5. Copy .env.example to .env and fill in the values.
 *  6. npm install && npm start. Collections, attributes and sample data are created on first run.
 *     (Collections can also be created manually in the console; see README.)
 */
require('dotenv').config();
const express = require('express');
const path = require('path');
const { Client, Databases, ID, Query } = require('node-appwrite');

const app = express();
const PORT = process.env.PORT || 3000;

const {
  APPWRITE_ENDPOINT = 'https://cloud.appwrite.io/v1',
  APPWRITE_PROJECT_ID,
  APPWRITE_API_KEY,
  APPWRITE_DATABASE_ID,
  APPWRITE_CATEGORIES_COLLECTION_ID = 'categories',
  APPWRITE_POSTS_COLLECTION_ID = 'posts'
} = process.env;

const missing = ['APPWRITE_PROJECT_ID', 'APPWRITE_API_KEY', 'APPWRITE_DATABASE_ID'].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(', ')}. Copy .env.example to .env and fill them in.`);
  process.exit(1);
}

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);
const databases = new Databases(client);

const DB = APPWRITE_DATABASE_ID;
const CATEGORIES = APPWRITE_CATEGORIES_COLLECTION_ID;
const POSTS = APPWRITE_POSTS_COLLECTION_ID;

// Convert Appwrite documents into the shape the EJS views expect.
const toCategory = (doc) => ({ id: doc.$id, name: doc.name, slug: doc.slug });
const toPost = (doc, categoryMap) => ({
  id: doc.$id,
  title: doc.title,
  slug: doc.slug,
  excerpt: doc.excerpt,
  content: doc.content,
  author: doc.author,
  category_id: doc.category_id,
  category_name: categoryMap.get(doc.category_id) || null,
  is_published: doc.is_published ? 1 : 0,
  created_at: doc.created_at || doc.$createdAt,
  updated_at: doc.updated_at || doc.$updatedAt
});

async function listAll(collectionId, queries = []) {
  const docs = [];
  const pageSize = 100;
  while (true) {
    const page = await databases.listDocuments(DB, collectionId, [
      ...queries,
      Query.limit(pageSize),
      Query.offset(docs.length)
    ]);
    docs.push(...page.documents);
    if (page.documents.length < pageSize) return docs;
  }
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'post';
}

const byNewest = (a, b) => new Date(b.created_at) - new Date(a.created_at);

async function getCategories() {
  const docs = await listAll(CATEGORIES);
  return docs.map(toCategory).sort((a, b) => a.name.localeCompare(b.name));
}

async function getCategoryMap() {
  const categories = await getCategories();
  return new Map(categories.map((c) => [c.id, c.name]));
}

async function getAllPosts() {
  const [docs, categoryMap] = await Promise.all([listAll(POSTS), getCategoryMap()]);
  return docs.map((doc) => toPost(doc, categoryMap)).sort(byNewest);
}

async function ensureUniqueSlug(baseTitle, excludeId = null) {
  const used = new Set((await listAll(POSTS)).filter((d) => d.$id !== excludeId).map((d) => d.slug));
  const base = slugify(baseTitle);
  let slug = base;
  let index = 2;
  while (used.has(slug)) {
    slug = `${base}-${index}`;
    index += 1;
  }
  return slug;
}

async function getPublishedPosts() {
  return (await getAllPosts()).filter((p) => p.is_published === 1);
}

async function getPostById(id) {
  try {
    const [doc, categoryMap] = await Promise.all([databases.getDocument(DB, POSTS, id), getCategoryMap()]);
    return toPost(doc, categoryMap);
  } catch (error) {
    if (error.code === 404) return null;
    throw error;
  }
}

async function getPostsByCategory(categoryId) {
  return (await getPublishedPosts()).filter((p) => p.category_id === categoryId);
}

async function getCategoryBySlug(slug) {
  return (await getCategories()).find((c) => c.slug === slug) || null;
}

function postData({ title, excerpt, content, author, category_id, is_published }) {
  return {
    title: title.trim(),
    excerpt: excerpt ? excerpt.trim() : '',
    content: content.trim(),
    author: author ? author.trim() : 'Admin',
    category_id: String(category_id),
    is_published: is_published === 'on'
  };
}

async function collectionExists(collectionId) {
  try {
    await databases.getCollection(DB, collectionId);
    return true;
  } catch (error) {
    if (error.code === 404) return false;
    throw error;
  }
}

// Wait until Appwrite finishes creating attributes, otherwise inserts fail.
async function waitForAttributes(collectionId) {
  for (let i = 0; i < 60; i += 1) {
    const { attributes } = await databases.listAttributes(DB, collectionId);
    if (attributes.every((a) => a.status === 'available')) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Attributes of collection "${collectionId}" were not ready in time.`);
}

async function initDatabase() {
  const permissions = []; // Server API key bypasses permissions; no public access needed.

  if (!(await collectionExists(CATEGORIES))) {
    await databases.createCollection(DB, CATEGORIES, 'Categories', permissions);
    await databases.createStringAttribute(DB, CATEGORIES, 'name', 255, true);
    await databases.createStringAttribute(DB, CATEGORIES, 'slug', 255, true);
    await waitForAttributes(CATEGORIES);
  }

  if (!(await collectionExists(POSTS))) {
    await databases.createCollection(DB, POSTS, 'Posts', permissions);
    await databases.createStringAttribute(DB, POSTS, 'title', 255, true);
    await databases.createStringAttribute(DB, POSTS, 'slug', 255, true);
    await databases.createStringAttribute(DB, POSTS, 'excerpt', 1000, false);
    await databases.createStringAttribute(DB, POSTS, 'content', 65535, true);
    await databases.createStringAttribute(DB, POSTS, 'author', 255, false, 'Admin');
    await databases.createStringAttribute(DB, POSTS, 'category_id', 64, false);
    await databases.createBooleanAttribute(DB, POSTS, 'is_published', false, false);
    await databases.createStringAttribute(DB, POSTS, 'created_at', 64, false);
    await databases.createStringAttribute(DB, POSTS, 'updated_at', 64, false);
    await waitForAttributes(POSTS);
  }

  if ((await listAll(CATEGORIES)).length === 0) {
    const defaultCategories = [
      ['Frontend', 'frontend'],
      ['Backend', 'backend'],
      ['UI/UX', 'ui-ux'],
      ['Productivity', 'productivity']
    ];

    for (const [name, slug] of defaultCategories) {
      await databases.createDocument(DB, CATEGORIES, ID.unique(), { name, slug });
    }
  }

  if ((await listAll(POSTS)).length === 0) {
    const categories = await getCategories();
    const bySlug = (slug) => categories.find((category) => category.slug === slug)?.id;

    const samplePosts = [
      {
        title: 'Cách xây dựng giao diện blog đẹp và tối ưu UX',
        excerpt: 'Hướng dẫn tạo blog dễ đọc và thân thiện trên nhiều thiết bị.',
        content: '# Cách xây dựng giao diện blog đẹp và tối ưu UX\n\n- Thiết kế rõ ràng, tối giản\n- Dùng khoảng cách hợp lý\n- Tạo tiêu đề dễ đọc\n- Tận dụng bố cục mobile-first\n\nMột blog hiệu quả không chỉ là đẹp, mà còn khiến người đọc dễ tập trung vào nội dung.',
        author: 'Tùng Mãi',
        category_id: bySlug('ui-ux'),
        is_published: true,
      },
      {
        title: 'Node.js và Express cho ứng dụng blog nhanh gọn',
        excerpt: 'Tại sao Express vẫn là lựa chọn phổ biến cho ứng dụng web nhỏ và vừa.',
        content: '# Node.js và Express cho ứng dụng blog nhanh gọn\n\nExpress giúp bạn xây dựng ứng dụng web rất nhanh.\n\nƯu điểm:\n- Route rõ ràng\n- Dễ tích hợp SQLite\n- Phù hợp với dự án nhỏ, vừa',
        author: 'Tùng Mãi',
        category_id: bySlug('backend'),
        is_published: true,
      },
      {
        title: 'Responsive web design là gì và vì sao quan trọng?',
        excerpt: 'Responsive giúp website hiển thị tốt trên điện thoại, tablet và desktop.',
        content: '# Responsive web design là gì?\n\nResponsive web design là cách thiết kế website thích ứng với nhiều kích thước màn hình.\n\n- Màn hình điện thoại: bố cục một cột\n- Máy tính bảng: bố cục 2 cột\n- Desktop: bố cục nhiều cột',
        author: 'Tùng Mãi',
        category_id: bySlug('frontend'),
        is_published: true,
      },
      {
        title: '7 thói quen giúp làm việc hiệu quả hơn mỗi ngày',
        excerpt: 'Một số thói quen nhỏ nhưng mang lại hiệu quả lớn trong công việc.',
        content: '# 7 thói quen giúp làm việc hiệu quả hơn mỗi ngày\n\n- Ưu tiên công việc quan trọng nhất\n- Chia nhỏ task\n- Tập trung 25 phút rồi nghỉ ngắn\n- Ghi chép tiến độ',
        author: 'Tùng Mãi',
        category_id: bySlug('productivity'),
        is_published: true,
      }
    ];

    for (const post of samplePosts) {
      const slug = await ensureUniqueSlug(post.title);
      const now = new Date().toISOString();
      await databases.createDocument(DB, POSTS, ID.unique(), {
        ...post,
        slug,
        created_at: now,
        updated_at: now
      });
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
    const category = await getCategoryBySlug(req.params.slug);
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

    const relatedPosts = (await getPublishedPosts()).filter((p) => p.id !== post.id).slice(0, 3);

    res.render('post', { title: post.title, post, relatedPosts });
  } catch (error) {
    console.error(error);
    res.status(500).send('Có lỗi xảy ra khi tải bài viết.');
  }
});

app.get('/admin', async (req, res) => {
  try {
    const posts = await getAllPosts();
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
    const { title, content, category_id } = req.body;

    if (!title || !content || !category_id) {
      return res.status(400).send('Vui lòng điền đầy đủ tiêu đề, nội dung và danh mục.');
    }

    const slug = await ensureUniqueSlug(title);
    const now = new Date().toISOString();
    await databases.createDocument(DB, POSTS, ID.unique(), {
      ...postData(req.body),
      slug,
      created_at: now,
      updated_at: now
    });

    res.redirect('/admin');
  } catch (error) {
    console.error(error);
    res.status(500).send('Không thể lưu bài viết.');
  }
});

app.post('/admin/posts/:id', async (req, res) => {
  try {
    const { title, content, category_id } = req.body;
    const id = req.params.id;

    if (!title || !content || !category_id) {
      return res.status(400).send('Vui lòng điền đầy đủ tiêu đề, nội dung và danh mục.');
    }

    const slug = await ensureUniqueSlug(title, id);
    await databases.updateDocument(DB, POSTS, id, {
      ...postData(req.body),
      slug,
      updated_at: new Date().toISOString()
    });

    res.redirect('/admin');
  } catch (error) {
    console.error(error);
    res.status(500).send('Không thể cập nhật bài viết.');
  }
});

app.post('/admin/posts/delete/:id', async (req, res) => {
  try {
    await databases.deleteDocument(DB, POSTS, req.params.id);
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

startServer().catch((error) => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});
