import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getAllScrapedDocuments } from "../services/scrapedDataset.service";
import { getAllDocumentChunks, syncDocumentChunksJsonFromDatabase, deleteDocumentById } from "../services/document.service";
import { generateEmbedding } from "../services/embedding.service";
import { chunkText } from "../utils/chunkText";
import { pool } from "../config/database";

const CHUNKS_PATH = path.join(process.cwd(), "src", "data", "documentChunks.json");

function createContentHash(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export async function syncScrapedDocumentsToChunks() {
  const scrapedDocs = getAllScrapedDocuments();
  
  // Test DB Connection
  await pool.query("SELECT 1");
  
  const [existingDocs]: any = await pool.query("SELECT id, fileName, contentHash FROM documents WHERE deletedAt IS NULL");
  const existingDocsMap = new Map<string, any>(existingDocs.map((d: any) => [d.fileName, d]));

  let addedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const doc of scrapedDocs) {
    const existing = existingDocsMap.get(doc.fileName);
    const contentHash = doc.contentHash || createContentHash(doc.extractedText);

    if (existing && existing.contentHash === contentHash) {
      skippedCount++;
      continue;
    }

    const documentId = existing ? existing.id : doc.id || `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const now = new Date().toISOString();

    const newChunksRaw = chunkText(doc.extractedText, {
      maxLength: 900,
      overlap: 150
    });

    const embeddedChunks = [];
    for (let i = 0; i < newChunksRaw.length; i++) {
      const text = newChunksRaw[i];
      const embedding = await generateEmbedding(text);
      embeddedChunks.push({
        id: `${documentId}-${i}`,
        documentId,
        documentTitle: doc.fileName,
        documentUrl: doc.localUrl,
        text,
        embedding
      });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      if (existing) {
        // Update
        await connection.query("DELETE FROM document_chunks WHERE documentId = ?", [documentId]);
        
        await connection.query(
          `UPDATE documents SET 
            title = ?, originalName = ?, mimetype = ?, url = ?, 
            sourceUrl = ?, localUrl = ?, totalChunks = ?, textLength = ?, 
            contentHash = ?, updatedAt = ?
           WHERE id = ?`,
          [
            doc.title, doc.fileName, doc.mimetype, doc.localUrl, 
            doc.sourceUrl, doc.localUrl, embeddedChunks.length, doc.extractedText.length, 
            contentHash, now, documentId
          ]
        );
        updatedCount++;
      } else {
        // Insert
        await connection.query(
          `INSERT INTO documents (
            id, title, fileName, originalName, mimetype, url, 
            sourceUrl, localUrl, totalChunks, textLength, contentHash, generatedBy, uploadedAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            documentId, doc.title, doc.fileName, doc.fileName, doc.mimetype, doc.localUrl,
            doc.sourceUrl, doc.localUrl, embeddedChunks.length, doc.extractedText.length, contentHash, doc.generatedBy || "scrapedDatasetGenerator", now, now
          ]
        );
        addedCount++;
      }

      // Insert chunks
      for (const chunk of embeddedChunks) {
        await connection.query(
          `INSERT INTO document_chunks (
            id, documentId, chunkIndex, documentTitle, documentUrl, text, embedding, createdAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            chunk.id, chunk.documentId, embeddedChunks.indexOf(chunk), chunk.documentTitle, chunk.documentUrl, 
            chunk.text, JSON.stringify(chunk.embedding), now
          ]
        );
      }

      await connection.commit();
      console.log(`Synced document to MySQL: ${doc.fileName}`);
    } catch (e) {
      await connection.rollback();
      console.error(`Failed to sync document ${doc.fileName}:`, e);
    } finally {
      connection.release();
    }
  }

  // Remove orphaned documents from DB that were originally from dataset but are no longer in scrapedDataset.json
  const scrapedFileNames = new Set(scrapedDocs.map(d => d.fileName));
  let removedCount = 0;
  for (const existing of existingDocs) {
    if (existing.fileName.endsWith(".pdf") || existing.fileName.endsWith(".docx") || existing.fileName.endsWith(".xlsx")) {
      // Check if it's managed by scraper (has localUrl starting with /dataset/)
      const [details]: any = await pool.query("SELECT localUrl FROM documents WHERE id = ?", [existing.id]);
      if (details[0]?.localUrl?.startsWith("/dataset/") && !scrapedFileNames.has(existing.fileName)) {
        await deleteDocumentById(existing.id);
        removedCount++;
        console.log(`Removed orphaned document from MySQL: ${existing.fileName}`);
      }
    }
  }

  // Finally export cache
  await syncDocumentChunksJsonFromDatabase();

  return {
    scrapedCount: scrapedDocs.length,
    addedToDb: addedCount,
    updatedInDb: updatedCount,
    skippedUnchanged: skippedCount,
    removedOrphans: removedCount,
  };
}

async function main() {
  if (require.main === module) {
    console.log("Starting sync to MySQL...");
    const result = await syncScrapedDocumentsToChunks();
    console.log("Sync Result:", result);
    process.exit(0);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
