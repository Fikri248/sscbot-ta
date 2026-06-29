-- 002_create_tables.sql

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  passwordHash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  createdAt VARCHAR(100) NOT NULL DEFAULT ''
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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
  updatedAt VARCHAR(100) NOT NULL DEFAULT '',
  deletedAt VARCHAR(100) NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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

SET FOREIGN_KEY_CHECKS = 1;
