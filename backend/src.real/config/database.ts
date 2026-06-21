import mysql from "mysql2/promise";

const shouldUseSSL = process.env.DB_SSL !== "false";

export const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "root",
  database: process.env.DB_NAME || "ssc_bot",
};

export const pool = mysql.createPool({
  ...dbConfig,
  ssl: shouldUseSSL
    ? {
        rejectUnauthorized: false,
      }
    : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function ensureColumn(tableName: string, columnName: string, ddl: string) {
  const [rows]: any = await pool.query(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [dbConfig.database, tableName, columnName]
  );

  if (!rows.length) {
    await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${ddl}`);
  }
}

export async function initDB() {
  try {
    await pool.query("SELECT 1");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        passwordHash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        createdAt VARCHAR(100) NOT NULL DEFAULT ''
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id VARCHAR(100) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        fileName VARCHAR(255) NOT NULL,
        originalName VARCHAR(255) NOT NULL,
        mimetype VARCHAR(150) NOT NULL,
        url VARCHAR(500) NOT NULL,
        sourceUrl VARCHAR(500) NULL,
        localUrl VARCHAR(500) NULL,
        totalChunks INT NOT NULL DEFAULT 0,
        textLength INT NOT NULL DEFAULT 0,
        contentHash VARCHAR(100) NULL,
        generatedBy VARCHAR(100) NOT NULL DEFAULT 'system',
        uploadedAt VARCHAR(100) NOT NULL,
        updatedAt VARCHAR(100) NOT NULL,
        deletedAt VARCHAR(100) NULL,
        UNIQUE KEY uniq_documents_fileName (fileName)
      )
    `);

    await ensureColumn("users", "createdAt", "createdAt VARCHAR(100) NOT NULL DEFAULT ''");
    await ensureColumn("documents", "sourceUrl", "sourceUrl VARCHAR(500) NULL");
    await ensureColumn("documents", "localUrl", "localUrl VARCHAR(500) NULL");
    await ensureColumn("documents", "textLength", "textLength INT NOT NULL DEFAULT 0");
    await ensureColumn("documents", "contentHash", "contentHash VARCHAR(100) NULL");
    await ensureColumn("documents", "generatedBy", "generatedBy VARCHAR(100) NOT NULL DEFAULT 'system'");
    await ensureColumn("documents", "updatedAt", "updatedAt VARCHAR(100) NOT NULL DEFAULT ''");
    await ensureColumn("documents", "deletedAt", "deletedAt VARCHAR(100) NULL");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS document_chunks (
        id VARCHAR(120) PRIMARY KEY,
        documentId VARCHAR(100) NOT NULL,
        chunkIndex INT NOT NULL,
        documentTitle VARCHAR(255) NOT NULL,
        documentUrl VARCHAR(500) NULL,
        text LONGTEXT NOT NULL,
        embedding LONGTEXT NOT NULL,
        createdAt VARCHAR(100) NOT NULL,
        INDEX idx_document_chunks_documentId (documentId),
        CONSTRAINT fk_document_chunks_document
          FOREIGN KEY (documentId) REFERENCES documents(id)
          ON DELETE CASCADE
      )
    `);

    const adminEmail = process.env.ADMIN_EMAIL || "admin";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
    const adminName = process.env.ADMIN_NAME || "Admin SSC";

    const [rows]: any = await pool.query(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [adminEmail]
    );

    if (rows.length === 0) {
      const bcrypt = await import("bcrypt");
      const hash = await bcrypt.default.hash(adminPassword, 10);

      await pool.query(
        "INSERT INTO users (id, name, email, passwordHash, role, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
        [Date.now().toString(), adminName, adminEmail, hash, "admin", new Date().toISOString()]
      );
    }

    console.log("✅ Aiven/MySQL Database initialized successfully");
  } catch (error) {
    console.error("❌ Aiven/MySQL Database initialization failed:", error);
  }
}
