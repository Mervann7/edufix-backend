const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// ── TÜM ARIZALAR ──
router.get('/', async (req, res) => {
  try {
    const durum = req.query.durum || null;
    let query = `
      SELECT a.*,
        e.kod AS ekipman_kod, e.tur AS ekipman_tur,
        CONCAT(b.ad, ' ', b.soyad) AS bildiren_adi,
        CONCAT(t.ad, ' ', t.soyad) AS tekniker_adi,
        TIMESTAMPDIFF(HOUR, a.baslangic_tarihi, IFNULL(a.cozum_tarihi, NOW())) AS gecen_saat
      FROM ariza_kayitlari a
      LEFT JOIN ekipmanlar e ON a.ekipman_id = e.id
      LEFT JOIN kullanicilar b ON a.bildiren_kullanici = b.id
      LEFT JOIN kullanicilar t ON a.mudahale_tekniker = t.id
    `;
    const params = [];
    if (durum) { query += ' WHERE a.durum = ?'; params.push(durum); }
    query += ' ORDER BY a.baslangic_tarihi DESC';
    const [rows] = await db.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Sunucu hatası.' });
  }
});

// ── ARIZA BİLDİR ──
router.post('/', async (req, res) => {
  const { ekipman_id, ariza_turu, belirti, oncelik } = req.body;
  if (!ekipman_id || !ariza_turu || !belirti) {
    return res.status(400).json({ success: false, message: 'Ekipman, arıza türü ve belirti zorunludur.' });
  }
  try {
    // Ekipmanı arızalı olarak işaretle
    await db.query("UPDATE ekipmanlar SET durum = 'arızalı' WHERE id = ?", [ekipman_id]);

    const [result] = await db.query(`
      INSERT INTO ariza_kayitlari (ekipman_id, ariza_turu, belirti, oncelik, bildiren_kullanici)
      VALUES (?, ?, ?, ?, ?)
    `, [ekipman_id, ariza_turu, belirti, oncelik||'orta', req.user.id]);

    res.status(201).json({ success: true, message: 'Arıza bildirildi.', id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Sunucu hatası.' });
  }
});

// ── ARIZA KAPAT ──
router.put('/:id/kapat', async (req, res) => {
  const { cozum_aciklama, yedek_parca, tamir_maliyeti, mudahale_tekniker } = req.body;
  try {
    const [ariza] = await db.query('SELECT ekipman_id FROM ariza_kayitlari WHERE id = ?', [req.params.id]);
    if (ariza.length === 0) return res.status(404).json({ success: false, message: 'Arıza bulunamadı.' });

    await db.query(`
      UPDATE ariza_kayitlari SET
        durum = 'kapalı', cozum_tarihi = NOW(),
        cozum_aciklama = ?, yedek_parca = ?,
        tamir_maliyeti = ?, mudahale_tekniker = ?
      WHERE id = ?
    `, [cozum_aciklama||null, yedek_parca||null, tamir_maliyeti||null, mudahale_tekniker||null, req.params.id]);

    // Ekipmanı tekrar aktif yap
    await db.query("UPDATE ekipmanlar SET durum = 'aktif' WHERE id = ?", [ariza[0].ekipman_id]);

    res.json({ success: true, message: 'Arıza kapatıldı.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Sunucu hatası.' });
  }
});

// ── DURUM GÜNCELLE ──
router.put('/:id/durum', async (req, res) => {
  const { durum } = req.body;
  try {
    await db.query('UPDATE ariza_kayitlari SET durum = ? WHERE id = ?', [durum, req.params.id]);
    res.json({ success: true, message: 'Durum güncellendi.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Sunucu hatası.' });
  }
});

module.exports = router;

// ── ARIZA SİL ──
router.delete('/:id', async (req, res) => {
  try {
    // Arızalı ekipmanı tekrar aktif yap
    const [ariza] = await db.query('SELECT ekipman_id, durum FROM ariza_kayitlari WHERE id = ?', [req.params.id]);
    if (ariza.length > 0 && ariza[0].durum !== 'kapalı') {
      await db.query("UPDATE ekipmanlar SET durum = 'aktif' WHERE id = ?", [ariza[0].ekipman_id]);
    }
    await db.query('DELETE FROM ariza_kayitlari WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Arıza kaydı silindi.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Sunucu hatası.' });
  }
});
