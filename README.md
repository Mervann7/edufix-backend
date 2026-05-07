-- ══════════════════════════════════════════════
-- EduFix Veritabanı Kurulum Scripti
-- MySQL 8.0+
-- Çalıştırma: mysql -u root -p < schema.sql
-- ══════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS edufix_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_turkish_ci;

USE edufix_db;

-- ── KULLANICILAR ──────────────────────────────
CREATE TABLE IF NOT EXISTS kullanicilar (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  ad          VARCHAR(50)  NOT NULL,
  soyad       VARCHAR(50)  NOT NULL,
  email       VARCHAR(120) NOT NULL UNIQUE,
  sifre_hash  VARCHAR(255) NOT NULL,
  rol         ENUM(
    'operatör',
    'şantiye_şefi',
    'müteahhit',
    'mühendis_mimar',
    'tekniker',
    'ekipman_sahibi',
    'admin'
  ) NOT NULL DEFAULT 'operatör',
  ogrenci_no  VARCHAR(20)  DEFAULT NULL,
  aktif       TINYINT(1)   NOT NULL DEFAULT 1,
  son_giris   DATETIME     DEFAULT NULL,
  olusturma   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  guncelleme  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_email (email),
  INDEX idx_rol   (rol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── EKİPMANLAR ───────────────────────────────
CREATE TABLE IF NOT EXISTS ekipmanlar (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  kod             VARCHAR(20)  NOT NULL UNIQUE,
  tur             VARCHAR(50)  NOT NULL,
  marka           VARCHAR(50)  DEFAULT NULL,
  model           VARCHAR(50)  DEFAULT NULL,
  uretim_yili     YEAR         DEFAULT NULL,
  sasi_no         VARCHAR(80)  DEFAULT NULL,
  motor_seri_no   VARCHAR(80)  DEFAULT NULL,
  operatör_id     INT          DEFAULT NULL,
  toplam_saat     DECIMAL(8,1) NOT NULL DEFAULT 0,
  durum           ENUM('aktif','bakımda','arızalı','çıkmış') NOT NULL DEFAULT 'aktif',
  giris_tarihi    DATE         DEFAULT NULL,
  notlar          TEXT         DEFAULT NULL,
  olusturma       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (operatör_id) REFERENCES kullanicilar(id) ON DELETE SET NULL,
  INDEX idx_durum (durum),
  INDEX idx_kod   (kod)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── ÇALIŞMA SAATLERİ ─────────────────────────
CREATE TABLE IF NOT EXISTS calisma_kayitlari (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  ekipman_id      INT          NOT NULL,
  operatör_id     INT          DEFAULT NULL,
  tarih           DATE         NOT NULL,
  acilis_saat     TIME         NOT NULL,
  kapanis_saat    TIME         DEFAULT NULL,
  acilis_sayac    DECIMAL(8,1) NOT NULL,
  kapanis_sayac   DECIMAL(8,1) DEFAULT NULL,
  net_sure        DECIMAL(5,1) GENERATED ALWAYS AS (
    CASE WHEN kapanis_sayac IS NOT NULL
    THEN ROUND(kapanis_sayac - acilis_sayac, 1)
    ELSE NULL END
  ) STORED,
  notlar          TEXT         DEFAULT NULL,
  olusturma       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (ekipman_id)  REFERENCES ekipmanlar(id)    ON DELETE CASCADE,
  FOREIGN KEY (operatör_id) REFERENCES kullanicilar(id)  ON DELETE SET NULL,
  INDEX idx_tarih      (tarih),
  INDEX idx_ekipman_id (ekipman_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── YAKIT KAYITLARI ──────────────────────────
CREATE TABLE IF NOT EXISTS yakit_kayitlari (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  ekipman_id      INT          NOT NULL,
  tarih           DATE         NOT NULL,
  miktar_litre    DECIMAL(7,2) NOT NULL,
  birim_fiyat     DECIMAL(6,2) NOT NULL,
  toplam_tutar    DECIMAL(9,2) GENERATED ALWAYS AS
                    (ROUND(miktar_litre * birim_fiyat, 2)) STORED,
  giren_kullanici INT          DEFAULT NULL,
  notlar          TEXT         DEFAULT NULL,
  olusturma       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (ekipman_id)      REFERENCES ekipmanlar(id)   ON DELETE CASCADE,
  FOREIGN KEY (giren_kullanici) REFERENCES kullanicilar(id) ON DELETE SET NULL,
  INDEX idx_tarih      (tarih),
  INDEX idx_ekipman_id (ekipman_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── BAKIM PLANLARI ───────────────────────────
CREATE TABLE IF NOT EXISTS bakim_planlari (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  ekipman_id        INT          NOT NULL,
  bakim_turu        VARCHAR(80)  NOT NULL,
  esik_saat         INT          NOT NULL,
  son_bakim_tarihi  DATE         DEFAULT NULL,
  son_bakim_saati   DECIMAL(8,1) DEFAULT NULL,
  sorumlu_tekniker  INT          DEFAULT NULL,
  aktif             TINYINT(1)   NOT NULL DEFAULT 1,
  olusturma         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (ekipman_id)       REFERENCES ekipmanlar(id)   ON DELETE CASCADE,
  FOREIGN KEY (sorumlu_tekniker) REFERENCES kullanicilar(id) ON DELETE SET NULL,
  INDEX idx_ekipman_id (ekipman_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── BAKIM GEÇMİŞİ ───────────────────────────
CREATE TABLE IF NOT EXISTS bakim_gecmisi (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  plan_id         INT          NOT NULL,
  ekipman_id      INT          NOT NULL,
  bakim_tarihi    DATE         NOT NULL,
  yapilan_islem   TEXT         NOT NULL,
  yedek_parca     VARCHAR(255) DEFAULT NULL,
  maliyet         DECIMAL(9,2) DEFAULT NULL,
  yapan_tekniker  INT          DEFAULT NULL,
  olusturma       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (plan_id)        REFERENCES bakim_planlari(id) ON DELETE CASCADE,
  FOREIGN KEY (ekipman_id)     REFERENCES ekipmanlar(id)     ON DELETE CASCADE,
  FOREIGN KEY (yapan_tekniker) REFERENCES kullanicilar(id)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── ARIZA KAYITLARI ──────────────────────────
CREATE TABLE IF NOT EXISTS ariza_kayitlari (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  ekipman_id          INT          NOT NULL,
  ariza_turu          VARCHAR(80)  NOT NULL,
  belirti             TEXT         NOT NULL,
  oncelik             ENUM('düşük','orta','acil') NOT NULL DEFAULT 'orta',
  bildiren_kullanici  INT          DEFAULT NULL,
  baslangic_tarihi    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cozum_tarihi        DATETIME     DEFAULT NULL,
  durum               ENUM('açık','incelemede','kapalı') NOT NULL DEFAULT 'açık',
  cozum_aciklama      TEXT         DEFAULT NULL,
  yedek_parca         VARCHAR(255) DEFAULT NULL,
  tamir_maliyeti      DECIMAL(9,2) DEFAULT NULL,
  mudahale_tekniker   INT          DEFAULT NULL,
  olusturma           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (ekipman_id)         REFERENCES ekipmanlar(id)   ON DELETE CASCADE,
  FOREIGN KEY (bildiren_kullanici) REFERENCES kullanicilar(id) ON DELETE SET NULL,
  FOREIGN KEY (mudahale_tekniker)  REFERENCES kullanicilar(id) ON DELETE SET NULL,
  INDEX idx_durum      (durum),
  INDEX idx_oncelik    (oncelik),
  INDEX idx_ekipman_id (ekipman_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ══════════════════════════════════════════════
-- ÖRNEK VERİLER (isteğe bağlı)
-- Admin şifresi: Admin123! (bcrypt hash)
-- ══════════════════════════════════════════════
INSERT IGNORE INTO kullanicilar (ad, soyad, email, sifre_hash, rol, ogrenci_no) VALUES
('Admin', 'EduFix', 'admin@edufix.com',
 '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
 'admin', NULL);

SELECT 'EduFix veritabanı başarıyla kuruldu! ✅' AS mesaj;
