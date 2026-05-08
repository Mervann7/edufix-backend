require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const app = express();

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5500',
  'http://localhost:3000',
  'http://127.0.0.1:5500',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS engellendi: ${origin}`));
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', require('./routes/auth'));

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'EduFix API çalışıyor ✅',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Endpoint bulunamadı: ${req.path}` });
});

app.use((err, req, res, next) => {
  console.error('Sunucu hatası:', err.message);
  res.status(500).json({ success: false, message: 'Beklenmeyen bir hata oluştu.' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 EduFix API çalışıyor → http://localhost:${PORT}`);
  console.log(`📋 Sağlık kontrolü  → http://localhost:${PORT}/api/health`);
  console.log(`🔐 Login endpoint   → POST http://localhost:${PORT}/api/auth/login`);
  console.log(`📝 Register endpoint→ POST http://localhost:${PORT}/api/auth/register\n`);
});
