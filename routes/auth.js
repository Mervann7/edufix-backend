const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db       = require('../config/db');
const router   = express.Router();

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, rol: user.rol },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// KAYIT OL
router.post('/register', [
  body('ad')   .trim().notEmpty().withMessage('Ad boş bırakılamaz.'),
  body('soyad').trim().notEmpty().withMessage('Soyad boş bırakılamaz.'),
  body('email').trim().isEmail().withMessage('Geçerli bir e-posta girin.').normalizeEmail(),
  body('sifre').isLength({ min: 6 }).withMessage('Şifre en az 6 karakter olmalı.'),
  body('rol').isIn([
    'operatör','şantiye_şefi','müteahhit',
    'mühendis_mimar','tekniker','ekipman_sahibi'
  ]).withMessage('Geçersiz rol.'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }

  const { ad, soyad, email, sifre, rol, ogrenci_no } = req.body;

  try {
    const [existing] = await db.query(
      'SELECT id FROM kullanicilar WHERE email = ?', [email]
    );
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Bu e-posta adresi zaten kayıtlı. Lütfen giriş yapın.'
      });
    }

    const sifreHash = await bcrypt.hash(sifre, 10);

    const [result] = await db.query(
      `INSERT INTO kullanicilar (ad, soyad, email, sifre_hash, rol, ogrenci_no)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [ad, soyad, email, sifreHash, rol, ogrenci_no || null]
    );

    const newUser = { id: result.insertId, ad, soyad, email, rol };
    const token   = generateToken(newUser);

    return res.status(201).json({
      success: true,
      message: 'Kayıt başarılı!',
      token,
      kullanici: { id: newUser.id, ad, soyad, email, rol }
    });

  } catch (err) {
    console.error('Register hatası:', err);
    return res.status(500).json({ success: false, message: 'Sunucu hatası.' });
  }
});

// GİRİŞ YAP
router.post('/login', [
  body('email').trim().isEmail().withMessage('Geçerli bir e-posta girin.').normalizeEmail(),
  body('sifre').notEmpty().withMessage('Şifre boş bırakılamaz.'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }

  const { email, sifre } = req.body;

  try {
    const [rows] = await db.query(
      'SELECT * FROM kullanicilar WHERE email = ? AND aktif = 1', [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Bu e-posta adresiyle kayıtlı bir hesap bulunamadı.'
      });
    }

    const user = rows[0];
    const sifreDogruMu = await bcrypt.compare(sifre, user.sifre_hash);

    if (!sifreDogruMu) {
      return res.status(401).json({
        success: false,
        message: 'Şifre hatalı. Lütfen tekrar deneyin.'
      });
    }

    await db.query(
      'UPDATE kullanicilar SET son_giris = NOW() WHERE id = ?', [user.id]
    );

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: 'Giriş başarılı!',
      token,
      kullanici: { id: user.id, ad: user.ad, soyad: user.soyad, email: user.email, rol: user.rol }
    });

  } catch (err) {
    console.error('Login hatası:', err);
    return res.status(500).json({ success: false, message: 'Sunucu hatası.' });
  }
});

// MEVCUT KULLANICI
const { authMiddleware } = require('../middleware/auth');

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, ad, soyad, email, rol, ogrenci_no, son_giris FROM kullanicilar WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
    }
    return res.json({ success: true, kullanici: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Sunucu hatası.' });
  }
});

module.exports = router;
