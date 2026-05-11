const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// ── DASHBOARD İSTATİSTİKLERİ ──
router.get('/stats', async (req, res) => {
  try {
    const [[ekipman]]  = await db.query("SELECT COUNT(*) AS toplam, SUM(durum='aktif') AS aktif, SUM(durum='bakımda') AS bakimda, SUM(durum='arızalı') AS arizali FROM ekipmanlar");
    const [[ariza]]    = await db.query("SELECT COUNT(*) AS acik FROM ariza_kayitlari WHERE durum != 'kapalı'");
    const [[yakit]]    = await db.query("SELECT COALESCE(SUM(toplam_tutar),0) AS aylik FROM yakit_kayitlari WHERE MONTH(tarih)=MONTH(NOW()) AND YEAR(tarih)=YEAR(NOW())");
    const [[bakim]]    = await db.query("SELECT COUNT(*) AS bekleyen FROM bakim_planlari b LEFT JOIN ekipmanlar e ON b.ekipman_id=e.id WHERE b.aktif=1 AND (e.toplam_saat - b.son_bakim_saati) >= b.esik_saat");

    // Son 7 günlük yakıt
    const [yakitGrafik] = await db.query(`
      SELECT DATE(tarih) AS gun, SUM(miktar_litre) AS litre
      FROM yakit_kayitlari
      WHERE tarih >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(tarih)
      ORDER BY gun ASC
    `);

    // Son aktiviteler
    const [aktiviteler] = await db.query(`
      (SELECT 'ariza' AS tip, a.baslangic_tarihi AS tarih,
        CONCAT(e.kod, ' – ', a.ariza_turu) AS baslik,
        a.belirti AS aciklama
       FROM ariza_kayitlari a LEFT JOIN ekipmanlar e ON a.ekipman_id=e.id
       ORDER BY a.baslangic_tarihi DESC LIMIT 3)
      UNION ALL
      (SELECT 'bakim' AS tip, NOW() AS tarih,
        CONCAT(e.kod, ' – Bakım Zamanı') AS baslik,
        b.bakim_turu AS aciklama
       FROM bakim_planlari b LEFT JOIN ekipmanlar e ON b.ekipman_id=e.id
       WHERE b.aktif=1 AND (e.toplam_saat - b.son_bakim_saati) >= b.esik_saat LIMIT 2)
      ORDER BY tarih DESC LIMIT 5
    `);

    res.json({
      success: true,
      data: {
        ekipman: { toplam: ekipman.toplam||0, aktif: ekipman.aktif||0, bakimda: ekipman.bakimda||0, arizali: ekipman.arizali||0 },
        acik_ariza: ariza.acik||0,
        aylik_yakit_tl: parseFloat(yakit.aylik)||0,
        bekleyen_bakim: bakim.bekleyen||0,
        yakit_grafik: yakitGrafik,
        aktiviteler,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Sunucu hatası.' });
  }
});

module.exports = router;
