const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// ── TÜM ÇALIŞMA KAYITLARI ──
router.get('/', async (req, res) => {
  try {
    const tarih = req.query.tarih || null;
    let query = `
      SELECT c.*, 
        e.kod AS ekipman_kod, e.tur AS ekipman_tur,
        CONCAT(k.ad, ' ', k.soyad) AS operatör_adi
      FROM calisma_kayitlari c
      LEFT JOIN ekipmanlar e ON c.ekipman_id = e.id
      LEFT JOIN kullanicilar k ON c.operatör_id = k.id
    `;
    const params = [];
    if (tarih) { query += ' WHERE c.tarih = ?'; params.push(tarih); }
    query += ' ORDER BY c.tarih DESC, c.olusturma DESC';
    const [rows] = await db.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Sunucu hatası.' });
  }
});

// ── ÇALIŞMA KAYDI EKLE ──
router.post('/', async (req, res) => {
  const { ekipman_id, operatör_id, tarih, acilis_saat, kapanis_saat, acilis_sayac, kapanis_sayac, notlar } = req.body;
  if (!ekipman_id || !tarih || !acilis_saat || !acilis_sayac) {
    return res.status(400).json({ success: false, message: 'Ekipman, tarih, açılış saati ve sayaç zorunludur.' });
  }
  try {
    const [result] = await db.query(`
      INSERT INTO calisma_kayitlari (ekipman_id, operatör_id, tarih, acilis_saat, kapanis_saat, acilis_sayac, kapanis_sayac, notlar)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [ekipman_id, operatör_id||null, tarih, acilis_saat, kapanis_saat||null, acilis_sayac, kapanis_sayac||null, notlar||null]);

    // Ekipmanın toplam saatini güncelle
    if (kapanis_sayac) {
      await db.query('UPDATE ekipmanlar SET toplam_saat = ? WHERE id = ?', [kapanis_sayac, ekipman_id]);
    }

    res.status(201).json({ success: true, message: 'Çalışma kaydı eklendi.', id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Sunucu hatası.' });
  }
});

// ── ÇALIŞMA KAYDI SİL ──
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM calisma_kayitlari WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Kayıt silindi.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Sunucu hatası.' });
  }
});

module.exports = router;
