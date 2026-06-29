-- 003_insert_seed_data.sql

SET NAMES utf8mb4;

-- Demo Admin
-- Email/Login: admin
-- Password: admin123
INSERT INTO users (id, name, email, passwordHash, role, createdAt)
VALUES (
  'seed-admin-12345', 
  'Admin Demo', 
  'admin', 
  '$2b$10$NRateVqCfWKUJGE0V.E9/eKyrp6p8ThC.CibdqRrBcSxDfvxp63M2', 
  'admin', 
  '2026-06-29T00:00:00.000Z'
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  passwordHash = VALUES(passwordHash),
  role = VALUES(role);

-- Demo User
-- Email/Login: kelompok4@sscbot
-- Password: kelompok4
INSERT INTO users (id, name, email, passwordHash, role, createdAt)
VALUES (
  'seed-user-12345', 
  'Kelompok 4', 
  'kelompok4@sscbot', 
  '$2b$10$1nTra1eylDF8a6Xbd612Iu3hb4AxOL36kzx.waJfjSfNJQK9gkQLC', 
  'user', 
  '2026-06-29T00:00:00.000Z'
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  passwordHash = VALUES(passwordHash),
  role = VALUES(role);

-- Note: Knowledge base data (documents and document_chunks) is deliberately omitted 
-- from this seed file because embedding vectors are too large and dependent on the 
-- specific AI model used.
--
-- To populate the knowledge base:
-- 1. Log in to the Admin Dashboard using the account above.
-- 2. Upload your PDF/DOCX/TXT files or click 'Perbarui Data' (Sync).
-- 3. The backend will automatically generate the chunks and embeddings.
