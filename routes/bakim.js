const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// ── TÜM BAKIM PLANLARI ──
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT b.*,
        e.kod AS ekipman_kod, e.tur AS ekipman_tur, e.toplam_saat,
        CONCAT(k.ad, ' ', k.soyad) AS tekniker_adi,
        (e.toplam_saat - (b.son_bakim_saati + b.esik_saat)) AS kalan_saat
      FROM bakim_planlari b
      LEFT JOIN ekipmanlar e ON b.ekipman_id = e.id
      LEFT JOIN kullanicilar k ON b.sorumlu_tekniker = k.id
      WHERE b.aktif = 1
      ORDER BY kalan_saat ASC
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Sunucu hatası.' });
  }
});

// ── BAKIM PLANI EKLE ──
router.post('/', async (req, res) => {
  const { ekipman_id, bakim_turu, esik_saat, son_bakim_tarihi, son_bakim_saati, sorumlu_tekniker } = req.body;
  if (!ekipman_id || !bakim_turu || !esik_saat) {
    return res.status(400).json({ success: false, message: 'Ekipman, bakım türü ve eşik saat zorunludur.' });
  }
  try {
    const [result] = await db.query(`
      INSERT INTO bakim_planlari (ekipman_id, bakim_turu, esik_saat, son_bakim_tarihi, son_bakim_saati, sorumlu_tekniker)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [ekipman_id, bakim_turu, esik_saat, son_bakim_tarihi||null, son_bakim_saati||0, sorumlu_tekniker||null]);
    res.status(201).json({ success: true, message: 'Bakım planı eklendi.', id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Sunucu hatası.' });
  }
});

// ── BAKIM TAMAMLANDI ──
router.post('/:id/tamamla', async (req, res) => {
  const { bakim_tarihi, yapilan_islem, yedek_parca, maliyet } = req.body;
  try {
    // Bakım geçmişine ekle
    const [plan] = await db.query('SELECT * FROM bakim_planlari WHERE id = ?', [req.params.id]);
    if (plan.length === 0) return res.status(404).json({ success: false, message: 'Plan bulunamadı.' });

    const [ekipman] = await db.query('SELECT toplam_saat FROM ekipmanlar WHERE id = ?', [plan[0].ekipman_id]);

    await db.query(`
      INSERT INTO bakim_gecmisi (plan_id, ekipman_id, bakim_tarihi, yapilan_islem, yedek_parca, maliyet, yapan_tekniker)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [req.params.id, plan[0].ekipman_id, bakim_tarihi, yapilan_islem, yedek_parca||null, maliyet||null, req.user.id]);

    // Planı güncelle
    await db.query(`
      UPDATE bakim_planlari SET son_bakim_tarihi = ?, son_bakim_saati = ? WHERE id = ?
    `, [bakim_tarihi, ekipman[0].toplam_saat, req.params.id]);

    res.json({ success: true, message: 'Bakım tamamlandı olarak işaretlendi.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Sunucu hatası.' });
  }
});

// ── BAKIM PLANI SİL ──
router.delete('/:id', async (req, res) => {
  try {
    await db.query('UPDATE bakim_planlari SET aktif = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Bakım planı silindi.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Sunucu hatası.' });
  }
});

module.exports = router;
