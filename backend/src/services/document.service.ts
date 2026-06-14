import fs from "fs";
import path from "path";
import { extractFileText } from "../utils/extractFileText";
import { chunkText } from "../utils/chunkText";
import { generateEmbedding } from "./embedding.service";
import { DocumentChunk } from "./rag.service";

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
const DOCUMENTS_PATH = path.join(DATA_DIR, "documents.json");
const CHUNKS_PATH = path.join(DATA_DIR, "documentChunks.json");

function ensureStorageReady() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  if (!fs.existsSync(DOCUMENTS_PATH)) {
    fs.writeFileSync(DOCUMENTS_PATH, JSON.stringify([], null, 2));
  }

  if (!fs.existsSync(CHUNKS_PATH)) {
    fs.writeFileSync(CHUNKS_PATH, JSON.stringify([], null, 2));
  }
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  ensureStorageReady();

  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const raw = fs.readFileSync(filePath, "utf-8");

  if (!raw.trim()) {
    return fallback;
  }

  return JSON.parse(raw) as T;
}

function writeJsonFile<T>(filePath: string, data: T) {
  ensureStorageReady();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export async function getAllDocuments(): Promise<DocumentRecord[]> {
  return readJsonFile<DocumentRecord[]>(DOCUMENTS_PATH, []);
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

  const document: DocumentRecord = {
    id: documentId,
    title: file.originalname,
    fileName: file.filename,
    originalName: file.originalname,
    mimetype: file.mimetype,
    url: fileUrl,
    totalChunks: embeddedChunks.length,
    uploadedAt: new Date().toISOString(),
  };

  const existingDocuments = await getAllDocuments();
  const existingChunks = await getAllDocumentChunks();

  writeJsonFile(DOCUMENTS_PATH, [...existingDocuments, document]);
  writeJsonFile(CHUNKS_PATH, [...existingChunks, ...embeddedChunks]);

  return {
    document,
    totalChunks: embeddedChunks.length,
  };
}

export async function deleteDocumentById(documentId: string) {
  const documents = await getAllDocuments();
  const chunks = await getAllDocumentChunks();

  const targetDocument = documents.find((doc) => doc.id === documentId);

  if (!targetDocument) {
    return {
      deleted: false,
      message: "Dokumen tidak ditemukan.",
    };
  }

  const filteredDocuments = documents.filter((doc) => doc.id !== documentId);
  const filteredChunks = chunks.filter((chunk) => chunk.documentId !== documentId);

  writeJsonFile(DOCUMENTS_PATH, filteredDocuments);
  writeJsonFile(CHUNKS_PATH, filteredChunks);

  const physicalFilePath = path.join(UPLOAD_DIR, targetDocument.fileName);

  if (fs.existsSync(physicalFilePath)) {
    fs.unlinkSync(physicalFilePath);
  }

  return {
    deleted: true,
    message: "Dokumen berhasil dihapus.",
  };
}