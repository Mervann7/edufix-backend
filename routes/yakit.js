const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// ── TÜM YAKIT KAYITLARI ──
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT y.*,
        e.kod AS ekipman_kod, e.tur AS ekipman_tur,
        CONCAT(k.ad, ' ', k.soyad) AS giren_adi
      FROM yakit_kayitlari y
      LEFT JOIN ekipmanlar e ON y.ekipman_id = e.id
      LEFT JOIN kullanicilar k ON y.giren_kullanici = k.id
      ORDER BY y.tarih DESC
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Sunucu hatası.' });
  }
});

// ── YAKIT İKMAL EKLE ──
router.post('/', async (req, res) => {
  const { ekipman_id, tarih, miktar_litre, birim_fiyat, notlar } = req.body;
  if (!ekipman_id || !tarih || !miktar_litre || !birim_fiyat) {
    return res.status(400).json({ success: false, message: 'Tüm alanlar zorunludur.' });
  }
  try {
    const [result] = await db.query(`
      INSERT INTO yakit_kayitlari (ekipman_id, tarih, miktar_litre, birim_fiyat, giren_kullanici, notlar)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [ekipman_id, tarih, miktar_litre, birim_fiyat, req.user.id, notlar||null]);
    res.status(201).json({ success: true, message: 'Yakıt kaydı eklendi.', id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Sunucu hatası.' });
  }
});

// ── YAKIT KAYDI SİL ──
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM yakit_kayitlari WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Kayıt silindi.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Sunucu hatası.' });
  }
});

module.exports = router;
