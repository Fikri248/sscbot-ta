import fs from "fs";
import path from "path";
import crypto from "crypto";
import { extractFileText } from "../utils/extractFileText";
import { chunkText } from "../utils/chunkText";
import { generateEmbedding } from "./embedding.service";
import { DocumentChunk } from "./rag.service";
import { pool } from "../config/database";
import { resolveOriginalSourceUrl } from "../utils/sourceUrlResolver";

export type DocumentRecord = {
  id: string;
  title: string;
  fileName: string;
  originalName: string;
  mimetype: string;
  url: string;
  sourceUrl?: string | null;
  localUrl?: string | null;
  totalChunks: number;
  textLength?: number;
  contentHash?: string | null;
  generatedBy?: string;
  uploadedAt: string;
  updatedAt?: string;
};

const DATA_DIR = path.join(process.cwd(), "src", "data");
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const DATASET_DIR = path.join(process.cwd(), "dataset");
const CHUNKS_PATH = path.join(DATA_DIR, "documentChunks.json");

function ensureStorageReady() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  if (!fs.existsSync(CHUNKS_PATH)) fs.writeFileSync(CHUNKS_PATH, JSON.stringify([], null, 2));
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  ensureStorageReady();
  if (!fs.existsSync(filePath)) return fallback;
  const raw = fs.readFileSync(filePath, "utf-8");
  if (!raw.trim()) return fallback;
  return JSON.parse(raw) as T;
}

function writeJsonFile<T>(filePath: string, data: T) {
  ensureStorageReady();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function createContentHash(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function getMimeTypeByExt(ext: string) {
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === ".doc") return "application/msword";
  if (ext === ".xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === ".xls") return "application/vnd.ms-excel";
  return "text/plain";
}

function cleanTitleFromFileName(fileName: string) {
  return fileName
    .replace(/^\d+[\.\-]+\s*/, "")
    .replace(/\.(pdf|docx|doc|xlsx|xls|txt)$/i, "");
}

async function buildEmbeddedChunks(params: {
  documentId: string;
  documentTitle: string;
  documentUrl: string;
  extractedText: string;
}) {
  const chunks = chunkText(params.extractedText, {
    maxLength: 900,
    overlap: 150,
  });

  if (!chunks.length) {
    throw new Error("Dokumen gagal dipotong menjadi chunk.");
  }

  const embeddedChunks: DocumentChunk[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const embedding = await generateEmbedding(chunks[i]);
    embeddedChunks.push({
      id: `${params.documentId}-${i}`,
      documentId: params.documentId,
      documentTitle: params.documentTitle,
      documentUrl: params.documentUrl,
      text: chunks[i],
      embedding,
    });
  }

  return embeddedChunks;
}

export async function syncDocumentChunksJsonFromDatabase() {
  try {
    const chunks = await getAllDocumentChunks({ preferDatabaseOnly: true });
    writeJsonFile(CHUNKS_PATH, chunks);
  } catch (error) {
    console.warn("Gagal membuat mirror documentChunks.json dari Aiven:", error);
  }
}

async function saveDocumentAndChunks(params: {
  id?: string;
  title: string;
  fileName: string;
  originalName: string;
  mimetype: string;
  url: string;
  sourceUrl?: string | null;
  localUrl?: string | null;
  extractedText: string;
  generatedBy: string;
}) {
  ensureStorageReady();

  const cleanText = params.extractedText.trim();
  if (!cleanText || cleanText.length < 20) {
    throw new Error("Isi dokumen tidak dapat dibaca atau terlalu pendek. Pastikan file berisi teks yang dapat dibaca.");
  }

  const [existingRows]: any = await pool.query(
    "SELECT id, contentHash FROM documents WHERE fileName = ? AND deletedAt IS NULL LIMIT 1",
    [params.fileName]
  );

  const contentHash = createContentHash(cleanText);
  const existing = existingRows[0];
  const documentId = params.id || existing?.id || `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const now = new Date().toISOString();
  const embeddedChunks = await buildEmbeddedChunks({
    documentId,
    documentTitle: params.title,
    documentUrl: params.url,
    extractedText: cleanText,
  });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query(
      `
        INSERT INTO documents
          (id, title, fileName, originalName, mimetype, url, sourceUrl, localUrl, totalChunks, textLength, contentHash, generatedBy, uploadedAt, updatedAt, deletedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
        ON DUPLICATE KEY UPDATE
          title = VALUES(title),
          fileName = VALUES(fileName),
          originalName = VALUES(originalName),
          mimetype = VALUES(mimetype),
          url = VALUES(url),
          sourceUrl = VALUES(sourceUrl),
          localUrl = VALUES(localUrl),
          totalChunks = VALUES(totalChunks),
          textLength = VALUES(textLength),
          contentHash = VALUES(contentHash),
          generatedBy = VALUES(generatedBy),
          updatedAt = VALUES(updatedAt),
          deletedAt = NULL
      `,
      [
        documentId,
        params.title,
        params.fileName,
        params.originalName,
        params.mimetype,
        params.url,
        params.sourceUrl || null,
        params.localUrl || params.url,
        embeddedChunks.length,
        cleanText.length,
        contentHash,
        params.generatedBy,
        now,
        now,
      ]
    );

    await connection.query("DELETE FROM document_chunks WHERE documentId = ?", [documentId]);

    for (let i = 0; i < embeddedChunks.length; i++) {
      const chunk = embeddedChunks[i];
      await connection.query(
        `
          INSERT INTO document_chunks
            (id, documentId, chunkIndex, documentTitle, documentUrl, text, embedding, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          chunk.id,
          documentId,
          i,
          chunk.documentTitle,
          chunk.documentUrl || null,
          chunk.text,
          JSON.stringify(chunk.embedding),
          now,
        ]
      );
    }

    await connection.commit();
    await syncDocumentChunksJsonFromDatabase();

    const document: DocumentRecord = {
      id: documentId,
      title: params.title,
      fileName: params.fileName,
      originalName: params.originalName,
      mimetype: params.mimetype,
      url: params.url,
      sourceUrl: params.sourceUrl || null,
      localUrl: params.localUrl || params.url,
      totalChunks: embeddedChunks.length,
      textLength: cleanText.length,
      contentHash,
      generatedBy: params.generatedBy,
      uploadedAt: now,
      updatedAt: now,
    };

    return { document, totalChunks: embeddedChunks.length };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getAllDocuments(): Promise<DocumentRecord[]> {
  try {
    const [rows]: any = await pool.query(
      `
        SELECT id, title, fileName, originalName, mimetype, url, sourceUrl, localUrl,
               totalChunks, textLength, contentHash, generatedBy, uploadedAt, updatedAt
        FROM documents
        WHERE deletedAt IS NULL
        ORDER BY COALESCE(NULLIF(updatedAt, ''), uploadedAt) DESC
      `
    );
    return rows;
  } catch (error) {
    console.error("Failed to get documents from Aiven/MySQL:", error);
    return [];
  }
}

export async function getDocumentById(documentId: string): Promise<DocumentRecord | null> {
  const [rows]: any = await pool.query(
    `SELECT * FROM documents WHERE id = ? AND deletedAt IS NULL LIMIT 1`,
    [documentId]
  );
  return rows[0] || null;
}

export async function getAllDocumentChunks(options?: { preferDatabaseOnly?: boolean }): Promise<DocumentChunk[]> {
  try {
    const [rows]: any = await pool.query(
      `
        SELECT c.id, c.documentId, c.documentTitle, c.documentUrl, c.text, c.embedding
        FROM document_chunks c
        INNER JOIN documents d ON d.id = c.documentId
        WHERE d.deletedAt IS NULL
        ORDER BY c.documentId ASC, c.chunkIndex ASC
      `
    );

    return rows.map((row: any) => ({
      id: row.id,
      documentId: row.documentId,
      documentTitle: row.documentTitle,
      documentUrl: row.documentUrl || undefined,
      text: row.text,
      embedding: JSON.parse(row.embedding || "[]"),
    }));
  } catch (error) {
    console.error("Failed to get chunks from Aiven/MySQL:", error);
    if (options?.preferDatabaseOnly) return [];
    return readJsonFile<DocumentChunk[]>(CHUNKS_PATH, []);
  }
}

export async function processUploadedDocument(file: Express.Multer.File, meta?: { title?: string; sourceUrl?: string | null }) {
  const extractedText = await extractFileText(String(file.path), String(file.mimetype));
  const fileUrl = `/uploads/${file.filename}`;

  return saveDocumentAndChunks({
    title: meta?.title?.trim() || file.originalname,
    fileName: file.filename,
    originalName: file.originalname,
    mimetype: file.mimetype,
    url: fileUrl,
    localUrl: fileUrl,
    sourceUrl: meta?.sourceUrl || null,
    extractedText,
    generatedBy: "adminUpload",
  });
}

export async function updateUploadedDocument(documentId: string, params: {
  file?: Express.Multer.File;
  title?: string;
  sourceUrl?: string | null;
}) {
  const existing = await getDocumentById(documentId);
  if (!existing) {
    return { updated: false, message: "Dokumen tidak ditemukan." };
  }

  if (params.file) {
    const extractedText = await extractFileText(String(params.file.path), String(params.file.mimetype));
    const fileUrl = `/uploads/${params.file.filename}`;

    const result = await saveDocumentAndChunks({
      id: existing.id,
      title: params.title?.trim() || existing.title || params.file.originalname,
      fileName: params.file.filename,
      originalName: params.file.originalname,
      mimetype: params.file.mimetype,
      url: fileUrl,
      localUrl: fileUrl,
      sourceUrl: params.sourceUrl === undefined ? existing.sourceUrl : params.sourceUrl,
      extractedText,
      generatedBy: "adminReplaceFile",
    });

    const oldPossibleFiles = [
      path.join(UPLOAD_DIR, existing.fileName),
      path.join(DATASET_DIR, existing.fileName),
    ];

    for (const oldPath of oldPossibleFiles) {
      if (fs.existsSync(oldPath) && path.basename(oldPath) !== params.file.filename) {
        fs.unlinkSync(oldPath);
      }
    }

    return { updated: true, document: result.document };
  }

  const result = await updateTextDataset(documentId, {
    title: params.title,
    sourceUrl: params.sourceUrl,
  });

  return result;
}

export async function createTextDataset(params: {
  title: string;
  fileName?: string;
  mimetype?: string;
  sourceUrl?: string | null;
  localUrl?: string | null;
  extractedText: string;
}) {
  const safeFileName = params.fileName || `${params.title.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase()}-${Date.now()}.txt`;
  const url = params.localUrl || `/admin-dataset/${encodeURIComponent(safeFileName)}`;

  return saveDocumentAndChunks({
    title: params.title,
    fileName: safeFileName,
    originalName: safeFileName,
    mimetype: params.mimetype || "text/plain",
    url,
    localUrl: url,
    sourceUrl: params.sourceUrl || null,
    extractedText: params.extractedText,
    generatedBy: "adminDashboard",
  });
}

export async function updateTextDataset(documentId: string, params: {
  title?: string;
  sourceUrl?: string | null;
  extractedText?: string;
}) {
  const [rows]: any = await pool.query(
    "SELECT * FROM documents WHERE id = ? AND deletedAt IS NULL LIMIT 1",
    [documentId]
  );

  if (!rows.length) {
    return { updated: false, message: "Dataset tidak ditemukan." };
  }

  const existing = rows[0];
  const title = params.title || existing.title;
  const sourceUrl = params.sourceUrl === undefined ? existing.sourceUrl : params.sourceUrl;

  if (params.extractedText && params.extractedText.trim()) {
    const result = await saveDocumentAndChunks({
      id: existing.id,
      title,
      fileName: existing.fileName,
      originalName: existing.originalName,
      mimetype: existing.mimetype,
      url: existing.url,
      localUrl: existing.localUrl || existing.url,
      sourceUrl,
      extractedText: params.extractedText,
      generatedBy: "adminDashboard",
    });

    return { updated: true, document: result.document };
  }

  await pool.query(
    "UPDATE documents SET title = ?, sourceUrl = ?, updatedAt = ?, generatedBy = ? WHERE id = ?",
    [title, sourceUrl, new Date().toISOString(), "adminDashboard", documentId]
  );

  await pool.query(
    "UPDATE document_chunks SET documentTitle = ? WHERE documentId = ?",
    [title, documentId]
  );

  await syncDocumentChunksJsonFromDatabase();

  const [updatedRows]: any = await pool.query("SELECT * FROM documents WHERE id = ? LIMIT 1", [documentId]);
  return { updated: true, document: updatedRows[0] };
}

export async function deleteDocumentById(documentId: string) {
  try {
    const [rows]: any = await pool.query("SELECT * FROM documents WHERE id = ? AND deletedAt IS NULL LIMIT 1", [documentId]);
    if (rows.length === 0) {
      return { deleted: false, message: "Dokumen tidak ditemukan." };
    }

    const targetDocument = rows[0];

    await pool.query("DELETE FROM document_chunks WHERE documentId = ?", [documentId]);
    await pool.query("DELETE FROM documents WHERE id = ?", [documentId]);

    const possiblePhysicalFiles = [
      path.join(UPLOAD_DIR, targetDocument.fileName),
      path.join(DATASET_DIR, targetDocument.fileName),
    ];

    for (const physicalFilePath of possiblePhysicalFiles) {
      if (fs.existsSync(physicalFilePath)) {
        fs.unlinkSync(physicalFilePath);
      }
    }

    await syncDocumentChunksJsonFromDatabase();

    return { deleted: true, message: "Dokumen berhasil dihapus dari Aiven, chunks, dan file fisik jika ada." };
  } catch (error) {
    console.error("Failed to delete document:", error);
    return { deleted: false, message: "Server error saat menghapus dokumen." };
  }
}

export async function importDatasetFromFolder() {
  ensureStorageReady();

  if (!fs.existsSync(DATASET_DIR)) {
    return { imported: 0, skipped: 0, errors: ["Dataset directory not found"] };
  }

  const files = fs.readdirSync(DATASET_DIR);
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();

    if (![".pdf", ".doc", ".docx", ".xlsx", ".xls", ".txt"].includes(ext)) {
      errors.push(`Skipped ${file}: Unsupported format`);
      skipped++;
      continue;
    }

    const filePath = path.join(DATASET_DIR, file);
    const mimetype = getMimeTypeByExt(ext);
    const localUrl = `/dataset/${encodeURIComponent(file)}`;
    const title = cleanTitleFromFileName(file);

    try {
      const extractedText = await extractFileText(filePath, mimetype);
      if (!extractedText || extractedText.trim().length < 20) {
        errors.push(`Skipped ${file}: Text too short or unreadable`);
        skipped++;
        continue;
      }

      const contentHash = createContentHash(extractedText.trim());
      const [existingRows]: any = await pool.query(
        "SELECT id, contentHash FROM documents WHERE fileName = ? AND deletedAt IS NULL LIMIT 1",
        [file]
      );

      if (existingRows.length && existingRows[0].contentHash === contentHash) {
        skipped++;
        continue;
      }

      await saveDocumentAndChunks({
        id: existingRows[0]?.id,
        title,
        fileName: file,
        originalName: file,
        mimetype,
        url: localUrl,
        localUrl,
        sourceUrl: resolveOriginalSourceUrl(title, localUrl),
        extractedText,
        generatedBy: "backendDatasetFolder",
      });

      imported++;
      console.log(`Successfully synced dataset to Aiven: ${file}`);
    } catch (e: any) {
      errors.push(`Skipped ${file}: Error - ${e.message}`);
      skipped++;
    }
  }

  await syncDocumentChunksJsonFromDatabase();

  return { imported, skipped, errors };
}
