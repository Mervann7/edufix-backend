const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

// Tüm route'lar token gerektiriyor
router.use(authMiddleware);

// ── TÜM EKİPMANLARI GETİR ──
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT e.*, 
        CONCAT(k.ad, ' ', k.soyad) AS operatör_adi
      FROM ekipmanlar e
      LEFT JOIN kullanicilar k ON e.operatör_id = k.id
      ORDER BY e.olusturma DESC
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Sunucu hatası.' });
  }
});

// ── TEK EKİPMAN GETİR ──
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT e.*, CONCAT(k.ad, ' ', k.soyad) AS operatör_adi
      FROM ekipmanlar e
      LEFT JOIN kullanicilar k ON e.operatör_id = k.id
      WHERE e.id = ?
    `, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Ekipman bulunamadı.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Sunucu hatası.' });
  }
});

// ── EKİPMAN EKLE ──
router.post('/', async (req, res) => {
  const { kod, tur, marka, model, uretim_yili, sasi_no, motor_seri_no, operatör_id, giris_tarihi, notlar } = req.body;
  if (!kod || !tur) return res.status(400).json({ success: false, message: 'Kod ve tür zorunludur.' });
  try {
    const [exist] = await db.query('SELECT id FROM ekipmanlar WHERE kod = ?', [kod]);
    if (exist.length > 0) return res.status(409).json({ success: false, message: 'Bu kod zaten kullanılıyor.' });

    const [result] = await db.query(`
      INSERT INTO ekipmanlar (kod, tur, marka, model, uretim_yili, sasi_no, motor_seri_no, operatör_id, giris_tarihi, notlar)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [kod, tur, marka||null, model||null, uretim_yili||null, sasi_no||null, motor_seri_no||null, operatör_id||null, giris_tarihi||null, notlar||null]);

    res.status(201).json({ success: true, message: 'Ekipman eklendi.', id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Sunucu hatası.' });
  }
});

// ── EKİPMAN GÜNCELLE ──
router.put('/:id', async (req, res) => {
  const { tur, marka, model, uretim_yili, sasi_no, motor_seri_no, operatör_id, durum, giris_tarihi, notlar } = req.body;
  try {
    await db.query(`
      UPDATE ekipmanlar SET
        tur=?, marka=?, model=?, uretim_yili=?, sasi_no=?,
        motor_seri_no=?, operatör_id=?, durum=?, giris_tarihi=?, notlar=?
      WHERE id=?
    `, [tur, marka||null, model||null, uretim_yili||null, sasi_no||null,
        motor_seri_no||null, operatör_id||null, durum||'aktif', giris_tarihi||null, notlar||null, req.params.id]);
    res.json({ success: true, message: 'Ekipman güncellendi.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Sunucu hatası.' });
  }
});

// ── EKİPMAN SİL ──
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM ekipmanlar WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Ekipman silindi.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Sunucu hatası.' });
  }
});

module.exports = router;
