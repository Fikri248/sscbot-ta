import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const dbMode = (process.env.DB_MODE || "local").toLowerCase();

let dbHost, dbPort, dbUser, dbPassword, dbName, dbSslStr, poolConfig;

if (dbMode === "aiven") {
  dbHost = process.env.AIVEN_DB_HOST;
  dbPort = Number(process.env.AIVEN_DB_PORT);
  dbUser = process.env.AIVEN_DB_USER;
  dbPassword = process.env.AIVEN_DB_PASSWORD;
  dbName = process.env.AIVEN_DB_NAME;
  dbSslStr = process.env.AIVEN_DB_SSL !== undefined ? process.env.AIVEN_DB_SSL : process.env.DB_SSL;
  
  poolConfig = {
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: dbName,
    ssl: { rejectUnauthorized: false },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 20000
  };
} else {
  dbHost = process.env.LOCAL_DB_HOST || "localhost";
  dbPort = Number(process.env.LOCAL_DB_PORT || 3306);
  dbUser = process.env.LOCAL_DB_USER || "root";
  dbPassword = process.env.LOCAL_DB_PASSWORD || "";
  dbName = process.env.LOCAL_DB_NAME || "ssc_bot";
  dbSslStr = process.env.LOCAL_DB_SSL !== undefined ? process.env.LOCAL_DB_SSL : process.env.DB_SSL;
  
  poolConfig = {
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: dbName,
    ssl: dbSslStr === "true" ? { rejectUnauthorized: false } : undefined,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 20000
  };
}

export const dbConfig = {
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPassword,
  database: dbName,
};

export const pool = mysql.createPool(poolConfig);

export const activeDbMode = dbMode;
export const activeDbSsl = dbSslStr !== "false";

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
    console.log(`Database Port: ${dbConfig.port}`);
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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id VARCHAR(100) PRIMARY KEY,
        userId VARCHAR(100) NULL,
        title VARCHAR(255) NOT NULL DEFAULT 'Percakapan Baru',
        createdAt VARCHAR(100) NOT NULL,
        updatedAt VARCHAR(100) NOT NULL,
        deletedAt VARCHAR(100) NULL,
        INDEX idx_chat_sessions_userId (userId),
        INDEX idx_chat_sessions_updatedAt (updatedAt)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id VARCHAR(120) PRIMARY KEY,
        sessionId VARCHAR(100) NOT NULL,
        role VARCHAR(30) NOT NULL,
        content LONGTEXT NOT NULL,
        sources LONGTEXT NULL,
        createdAt VARCHAR(100) NOT NULL,
        INDEX idx_chat_messages_sessionId (sessionId),
        INDEX idx_chat_messages_createdAt (createdAt),
        CONSTRAINT fk_chat_messages_session
          FOREIGN KEY (sessionId) REFERENCES chat_sessions(id)
          ON DELETE CASCADE
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
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

    console.log(`✅ Aiven/MySQL Database initialized successfully (Host: ${dbConfig.host}:${dbConfig.port})`);
  } catch (error) {
    console.error("❌ Aiven/MySQL Database initialization failed:", error);
  }
}
