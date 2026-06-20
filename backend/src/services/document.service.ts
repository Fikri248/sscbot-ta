import fs from "fs";
import path from "path";
import { extractFileText } from "../utils/extractFileText";
import { chunkText } from "../utils/chunkText";
import { generateEmbedding } from "./embedding.service";
import { DocumentChunk } from "./rag.service";
import { pool } from "../config/database";

export type DocumentRecord = {
  id: string;
  title: string;
  fileName: string;
  originalName: string;
  mimetype: string;
  url: string;
  totalChunks: number;
  uploadedAt: string;
};

const DATA_DIR = path.join(process.cwd(), "src", "data");
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const CHUNKS_PATH = path.join(DATA_DIR, "documentChunks.json");

function ensureStorageReady() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  if (!fs.existsSync(CHUNKS_PATH)) {
    fs.writeFileSync(CHUNKS_PATH, JSON.stringify([], null, 2));
  }
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

export async function getAllDocuments(): Promise<DocumentRecord[]> {
  try {
    const [rows]: any = await pool.query('SELECT * FROM documents');
    return rows;
  } catch (error) {
    console.error("Failed to get documents from MySQL:", error);
    return [];
  }
}

export async function getAllDocumentChunks(): Promise<DocumentChunk[]> {
  return readJsonFile<DocumentChunk[]>(CHUNKS_PATH, []);
}

export async function processUploadedDocument(file: Express.Multer.File) {
  ensureStorageReady();

  const documentId = Date.now().toString();
  const fileUrl = `/uploads/${file.filename}`;

  const extractedText = await extractFileText(
    String(file.path),
    String(file.mimetype)
  );

  if (!extractedText || extractedText.trim().length < 50) {
    throw new Error(
      "Isi dokumen tidak dapat dibaca atau terlalu pendek. Pastikan file berisi teks yang dapat dibaca."
    );
  }

  const chunks = chunkText(extractedText, {
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
      id: `${documentId}-${i}`,
      documentId,
      documentTitle: file.originalname,
      documentUrl: fileUrl,
      text: chunks[i],
      embedding,
    });
  }

  const uploadedAt = new Date().toISOString();

  await pool.query(
    'INSERT INTO documents (id, title, fileName, originalName, mimetype, url, totalChunks, uploadedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [documentId, file.originalname, file.filename, file.originalname, file.mimetype, fileUrl, embeddedChunks.length, uploadedAt]
  );

  const document: DocumentRecord = {
    id: documentId,
    title: file.originalname,
    fileName: file.filename,
    originalName: file.originalname,
    mimetype: file.mimetype,
    url: fileUrl,
    totalChunks: embeddedChunks.length,
    uploadedAt,
  };

  const existingChunks = await getAllDocumentChunks();
  writeJsonFile(CHUNKS_PATH, [...existingChunks, ...embeddedChunks]);

  return {
    document,
    totalChunks: embeddedChunks.length,
  };
}

export async function deleteDocumentById(documentId: string) {
  try {
    const [rows]: any = await pool.query('SELECT * FROM documents WHERE id = ?', [documentId]);
    if (rows.length === 0) {
      return { deleted: false, message: "Dokumen tidak ditemukan." };
    }
    const targetDocument = rows[0];

    await pool.query('DELETE FROM documents WHERE id = ?', [documentId]);

    const chunks = await getAllDocumentChunks();
    const filteredChunks = chunks.filter((chunk) => chunk.documentId !== documentId);
    writeJsonFile(CHUNKS_PATH, filteredChunks);

    const physicalFilePath = path.join(UPLOAD_DIR, targetDocument.fileName);
    if (fs.existsSync(physicalFilePath)) {
      fs.unlinkSync(physicalFilePath);
    }

    return { deleted: true, message: "Dokumen berhasil dihapus." };
  } catch (error) {
    console.error("Failed to delete document:", error);
    return { deleted: false, message: "Server error saat menghapus dokumen." };
  }
}

export async function importDatasetFromFolder() {
  const datasetDir = path.join(process.cwd(), "dataset");
  
  if (!fs.existsSync(datasetDir)) {
    return { imported: 0, skipped: 0, errors: ["Dataset directory not found"] };
  }

  const files = fs.readdirSync(datasetDir);
  const existingDocs = await getAllDocuments();
  const existingChunks = await getAllDocumentChunks();
  
  const newChunks = [...existingChunks];
  
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    
    if (![".pdf", ".docx", ".xlsx", ".txt"].includes(ext)) {
      errors.push(`Skipped ${file}: Unsupported format`);
      skipped++;
      continue;
    }

    if (
      existingDocs.some(d => d.originalName === file) ||
      existingChunks.some(c => c.documentTitle === file)
    ) {
      errors.push(`Skipped ${file}: Already indexed`);
      skipped++;
      continue;
    }

    const filePath = path.join(datasetDir, file);
    
    let mimetype = "text/plain";
    if (ext === ".pdf") mimetype = "application/pdf";
    if (ext === ".docx") mimetype = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (ext === ".xlsx") mimetype = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    try {
      const documentId = Date.now().toString() + "-" + Math.floor(Math.random() * 1000);
      const fileUrl = `/dataset/${encodeURIComponent(file)}`;

      const extractedText = await extractFileText(filePath, mimetype);

      if (!extractedText || extractedText.trim().length < 50) {
        errors.push(`Skipped ${file}: Text too short or unreadable`);
        skipped++;
        continue;
      }

      const chunks = chunkText(extractedText, {
        maxLength: 900,
        overlap: 150,
      });

      if (!chunks.length) {
        errors.push(`Skipped ${file}: Failed to chunk`);
        skipped++;
        continue;
      }

      const embeddedChunks: DocumentChunk[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const embedding = await generateEmbedding(chunks[i]);
        embeddedChunks.push({
          id: `${documentId}-${i}`,
          documentId,
          documentTitle: file,
          documentUrl: fileUrl,
          text: chunks[i],
          embedding,
        });
      }

      const uploadedAt = new Date().toISOString();

      try {
        await pool.query(
          'INSERT INTO documents (id, title, fileName, originalName, mimetype, url, totalChunks, uploadedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [documentId, file, file, file, mimetype, fileUrl, embeddedChunks.length, uploadedAt]
        );
      } catch (dbErr) {
        console.warn(`Failed to insert ${file} into MySQL, but continuing JSON indexing...`, dbErr);
      }

      newChunks.push(...embeddedChunks);
      imported++;
      
      console.log(`Successfully indexed: ${file} (${embeddedChunks.length} chunks)`);
    } catch (e: any) {
      errors.push(`Skipped ${file}: Error - ${e.message}`);
      skipped++;
    }
  }

  writeJsonFile(CHUNKS_PATH, newChunks);

  return { imported, skipped, errors };
}