import mysql from 'mysql2/promise';

export const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ssc_bot',
};

export const pool = mysql.createPool({
  ...dbConfig,
  ssl: {
    rejectUnauthorized: false,
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export async function initDB() {
  try {
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      ssl: {
        rejectUnauthorized: false,
      },
    });

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\`;`);
    await connection.end();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        passwordHash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user'
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id VARCHAR(100) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        fileName VARCHAR(255) NOT NULL,
        originalName VARCHAR(255) NOT NULL,
        mimetype VARCHAR(100) NOT NULL,
        url VARCHAR(255) NOT NULL,
        totalChunks INT NOT NULL,
        uploadedAt VARCHAR(100) NOT NULL
      )
    `);

    const [rows]: any = await pool.query(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      ['admin']
    );

    if (rows.length === 0) {
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.default.hash('admin123', 10);

      await pool.query(
        'INSERT INTO users (id, name, email, passwordHash, role) VALUES (?, ?, ?, ?, ?)',
        [Date.now().toString(), 'Admin SSC', 'admin', hash, 'admin']
      );
    }

    console.log('✅ MySQL Database initialized successfully');
  } catch (error) {
    console.error('❌ MySQL Database initialization failed:', error);
  }
}