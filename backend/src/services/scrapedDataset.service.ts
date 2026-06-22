import fs from "fs";
import path from "path";
import crypto from "crypto";
import { extractFileText } from "../utils/extractFileText";
import { resolveOriginalSourceUrl } from "../utils/sourceUrlResolver1";
import { chunkText } from "../utils/chunkText";

const DATA_DIR = path.join(process.cwd(), "src", "data");
const SCRAPED_DATASET_PATH = path.join(DATA_DIR, "scrapedDataset.json");

export type ScrapedDocument = {
  id: string;
  title: string;
  fileName: string;
  mimetype: string;
  sourceUrl: string | null;
  localUrl: string;
  extractedText: string;
  textLength: number;
  chunkCount: number;
  updatedAt: string;
  contentHash: string;
  generatedBy: string;
};

function ensureStorageReady() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(SCRAPED_DATASET_PATH)) {
    fs.writeFileSync(SCRAPED_DATASET_PATH, JSON.stringify([], null, 2));
  }
}

export function getAllScrapedDocuments(): ScrapedDocument[] {
  ensureStorageReady();
  const raw = fs.readFileSync(SCRAPED_DATASET_PATH, "utf-8");
  if (!raw.trim()) return [];
  return JSON.parse(raw) as ScrapedDocument[];
}

export function saveScrapedDocuments(docs: ScrapedDocument[]) {
  ensureStorageReady();
  fs.writeFileSync(SCRAPED_DATASET_PATH, JSON.stringify(docs, null, 2));
}

export function upsertScrapedDocument(record: ScrapedDocument) {
  const docs = getAllScrapedDocuments();
  const index = docs.findIndex(d => d.fileName === record.fileName);
  if (index >= 0) {
    docs[index] = record;
  } else {
    docs.push(record);
  }
  saveScrapedDocuments(docs);
}

export function deleteScrapedDocumentByFileName(fileName: string) {
  const docs = getAllScrapedDocuments();
  const filtered = docs.filter(d => d.fileName !== fileName);
  saveScrapedDocuments(filtered);
}

function getMimeType(ext: string) {
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === ".doc") return "application/msword";
  if (ext === ".xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return "text/plain";
}

export async function importDatasetToScrapedFile() {
  const datasetDir = path.join(process.cwd(), "..", "dataset");
  // Wait, process.cwd() is 'backend' during `node dist/...`, so `../dataset` is C:\laragon\www\ssc-bot\dataset? No, the dataset folder is `backend/dataset`.
  // So path.join(process.cwd(), "dataset").
  let actualDatasetDir = path.join(process.cwd(), "dataset");
  if (!fs.existsSync(actualDatasetDir)) {
    actualDatasetDir = path.join(__dirname, "../../../dataset");
  }

  if (!fs.existsSync(actualDatasetDir)) {
    return { imported: 0, skipped: 0, errors: ["Dataset directory not found"] };
  }

  const files = fs.readdirSync(actualDatasetDir);
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  const existingDocs = getAllScrapedDocuments();

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    
    if (![".pdf", ".doc", ".docx", ".xlsx", ".txt"].includes(ext)) {
      errors.push(`Skipped ${file}: Unsupported format`);
      skipped++;
      continue;
    }

    const filePath = path.join(actualDatasetDir, file);
    const mimetype = getMimeType(ext);
    const localUrl = `/dataset/${encodeURIComponent(file)}`;

    try {
      const extractedText = await extractFileText(filePath, mimetype);

      if (!extractedText || extractedText.trim().length < 50) {
        errors.push(`Skipped ${file}: Text too short or unreadable`);
        skipped++;
        continue;
      }

      const chunks = chunkText(extractedText, { maxLength: 900, overlap: 150 });
      const contentHash = crypto.createHash("sha256").update(extractedText).digest("hex");
      
      const existing = existingDocs.find(d => d.fileName === file);
      if (existing && existing.contentHash === contentHash) {
        continue;
      }

      const cleanTitle = file.replace(/^\d+[\.\-]+\s*/, "").replace(/\.(pdf|docx|doc|xlsx|txt)$/i, "");
      const sourceUrl = resolveOriginalSourceUrl(cleanTitle, localUrl);

      const record: ScrapedDocument = {
        id: existing ? existing.id : Date.now().toString() + "-" + Math.floor(Math.random() * 1000),
        title: cleanTitle,
        fileName: file,
        mimetype,
        sourceUrl,
        localUrl,
        extractedText,
        textLength: extractedText.length,
        chunkCount: chunks.length,
        updatedAt: new Date().toISOString(),
        contentHash,
        generatedBy: "scrapedDatasetGenerator"
      };

      upsertScrapedDocument(record);
      imported++;
      console.log(`Successfully scraped: ${file}`);
    } catch (e: any) {
      if (e.message.includes("DOC extraction is not supported")) {
        errors.push(`Skipped ${file}: DOC extraction is not supported yet`);
      } else {
        errors.push(`Skipped ${file}: Error - ${e.message}`);
      }
      skipped++;
    }
  }

  return { imported, skipped, errors };
}
