const mysql = require('mysql2/promise');
require('dotenv').config();

// Bağlantı havuzu oluştur (tek bağlantı yerine pool daha güvenli)
const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 3306,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'edufix_db',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone: '+03:00', // Türkiye saati
});

// Bağlantıyı test et
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('✅ MySQL bağlantısı başarılı →', process.env.DB_HOST);
    conn.release();
  } catch (err) {
    console.error('❌ MySQL bağlantı hatası:', err.message);
    process.exit(1);
  }
}

testConnection();

module.exports = pool;
