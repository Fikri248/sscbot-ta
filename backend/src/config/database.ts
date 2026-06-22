import mysql from "mysql2/promise";

const mode = process.env.DB_MODE?.toLowerCase();

let dbHost = process.env.DB_HOST || "localhost";
let dbPort = Number(process.env.DB_PORT) || 3306;
let dbUser = process.env.DB_USER || "root";
let dbPassword = process.env.DB_PASSWORD || "root";
let dbName = process.env.DB_NAME || "ssc_bot";
let dbSslStr = process.env.DB_SSL;

if (mode === "local") {
  dbHost = process.env.LOCAL_DB_HOST || dbHost;
  dbPort = Number(process.env.LOCAL_DB_PORT) || dbPort;
  dbUser = process.env.LOCAL_DB_USER || dbUser;
  dbPassword = process.env.LOCAL_DB_PASSWORD || dbPassword;
  dbName = process.env.LOCAL_DB_NAME || dbName;
  dbSslStr = process.env.LOCAL_DB_SSL !== undefined ? process.env.LOCAL_DB_SSL : dbSslStr;
} else if (mode === "aiven") {
  dbHost = process.env.AIVEN_DB_HOST || dbHost;
  dbPort = Number(process.env.AIVEN_DB_PORT) || dbPort;
  dbUser = process.env.AIVEN_DB_USER || dbUser;
  dbPassword = process.env.AIVEN_DB_PASSWORD || dbPassword;
  dbName = process.env.AIVEN_DB_NAME || dbName;
  dbSslStr = process.env.AIVEN_DB_SSL !== undefined ? process.env.AIVEN_DB_SSL : dbSslStr;
}

const shouldUseSSL = dbSslStr !== "false";

export const dbConfig = {
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPassword,
  database: dbName,
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

export const activeDbMode = mode || "legacy";
export const activeDbSsl = shouldUseSSL;

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
    console.log(`\n=== Database Configuration ===`);
    console.log(`Database Mode: ${activeDbMode}`);
    console.log(`Database Host: ${dbConfig.host}`);
    console.log(`Database Name: ${dbConfig.database}`);
    console.log(`SSL Enabled: ${activeDbSsl}\n`);

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
        url VARCHAR(1000) NOT NULL,
        sourceUrl VARCHAR(1000) NULL,
        localUrl VARCHAR(1000) NULL,
        totalChunks INT NOT NULL DEFAULT 0,
        textLength INT NOT NULL DEFAULT 0,
        contentHash VARCHAR(100) NULL,
        generatedBy VARCHAR(100) NOT NULL DEFAULT 'system',
        uploadedAt VARCHAR(100) NOT NULL,
        updatedAt VARCHAR(100) NOT NULL,
        deletedAt VARCHAR(100) NULL
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);

    await ensureColumn("users", "createdAt", "createdAt VARCHAR(100) NOT NULL DEFAULT ''");
    await ensureColumn("documents", "sourceUrl", "sourceUrl VARCHAR(1000) NULL");
    await ensureColumn("documents", "localUrl", "localUrl VARCHAR(1000) NULL");
    await ensureColumn("documents", "textLength", "textLength INT NOT NULL DEFAULT 0");
    await ensureColumn("documents", "contentHash", "contentHash VARCHAR(100) NULL");
    await ensureColumn("documents", "generatedBy", "generatedBy VARCHAR(100) NOT NULL DEFAULT 'system'");
    await ensureColumn("documents", "updatedAt", "updatedAt VARCHAR(100) NOT NULL DEFAULT ''");
    await ensureColumn("documents", "deletedAt", "deletedAt VARCHAR(100) NULL");

    // Also alter existing columns if they are already 500
    try {
      await pool.query("ALTER TABLE documents MODIFY sourceUrl VARCHAR(1000) NULL");
      await pool.query("ALTER TABLE documents MODIFY localUrl VARCHAR(1000) NULL");
      await pool.query("ALTER TABLE documents MODIFY url VARCHAR(1000) NOT NULL");
    } catch(e) {}

    await pool.query(`
      CREATE TABLE IF NOT EXISTS document_chunks (
        id VARCHAR(120) PRIMARY KEY,
        documentId VARCHAR(100) NOT NULL,
        chunkIndex INT NOT NULL,
        documentTitle VARCHAR(255) NOT NULL,
        documentUrl VARCHAR(1000) NULL,
        text LONGTEXT NOT NULL,
        embedding LONGTEXT NOT NULL,
        createdAt VARCHAR(100) NOT NULL,
        INDEX idx_document_chunks_documentId (documentId)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);

    try {
      await pool.query("ALTER TABLE document_chunks MODIFY documentUrl VARCHAR(1000) NULL");
      await pool.query("ALTER TABLE documents CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
      await pool.query("ALTER TABLE document_chunks CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    } catch(e) {}

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

    console.log(`✅ Aiven/MySQL Database initialized successfully (Host: ${dbConfig.host}:${dbConfig.port})`);
  } catch (error) {
    console.error("❌ Aiven/MySQL Database initialization failed:", error);
  }
}
