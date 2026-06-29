-- 003_insert_seed_data.sql

SET NAMES utf8mb4;

-- Insert default admin user
-- Password for this account is: Admin123!
INSERT IGNORE INTO users (id, name, email, passwordHash, role, createdAt)
VALUES (
  'seed-admin-12345', 
  'Admin SSC', 
  'admin@ssc.test', 
  '$2b$10$bIGBao6jbfSB5L.i35pfc.WD8HQ2zwxhllNOVFrMuoHse5sYoblmu', 
  'admin', 
  '2026-06-29T00:00:00.000Z'
);

-- Note: Knowledge base data (documents and document_chunks) is deliberately omitted 
-- from this seed file because embedding vectors are too large and dependent on the 
-- specific AI model used.
--
-- To populate the knowledge base:
-- 1. Log in to the Admin Dashboard using the account above.
-- 2. Upload your PDF/DOCX/TXT files or click 'Perbarui Data' (Sync).
-- 3. The backend will automatically generate the chunks and embeddings.
