import fs from "fs";
import path from "path";
import { getAllScrapedDocuments } from "../services/scrapedDataset.service";
import { getAllDocumentChunks } from "../services/document.service";
import { generateEmbedding } from "../services/embedding.service";
import { chunkText } from "../utils/chunkText";

const CHUNKS_PATH = path.join(process.cwd(), "src", "data", "documentChunks.json");

export async function syncScrapedDocumentsToChunks() {
  const scrapedDocs = getAllScrapedDocuments();
  const chunks = await getAllDocumentChunks();

  let missingCount = 0;
  let startingChunksCount = chunks.length;

  for (const doc of scrapedDocs) {
    const hasChunks = chunks.some(c => c.documentTitle === doc.fileName || c.documentUrl === doc.localUrl);
    
    if (!hasChunks) {
      console.log(`Missing chunks for: ${doc.fileName}`);
      missingCount++;

      const newChunksRaw = chunkText(doc.extractedText, {
        maxLength: 900,
        overlap: 150
      });

      for (let i = 0; i < newChunksRaw.length; i++) {
        const text = newChunksRaw[i];
        const embedding = await generateEmbedding(text);
        
        const chunk = {
          id: `${doc.id}-${i}`,
          documentId: doc.id,
          documentTitle: doc.fileName,
          documentUrl: doc.localUrl,
          text,
          embedding
        };

        chunks.push(chunk);
      }
    }
  }

  // Filter out chunks that do not match any scraped document (e.g. deleted dataset files)
  const validChunks = chunks.filter(c => {
    const isDocChunk = scrapedDocs.some(d => d.id === c.documentId || d.fileName === c.documentTitle || d.localUrl === c.documentUrl);
    // If it has documentTitle but it's not in scrapedDocs, we filter it out (unless it's from manual file uploads in SQL database)
    // Actually, manual uploaded files are in SQL documents table. How to check them?
    // In ssc-chatbot, let's keep all chunks whose documentId matches either scrapedDocs OR an existing SQL document.
    // Or simpler: if it has an id/documentTitle matching a deleted scrapedDoc, discard it.
    // Let's filter: if it was a scraped dataset (localUrl begins with /dataset/), and is not in scrapedDocs, remove it!
    const isDatasetFile = c.documentUrl?.startsWith("/dataset/");
    if (isDatasetFile) {
      return scrapedDocs.some(d => d.fileName === c.documentTitle || d.localUrl === c.documentUrl);
    }
    return true;
  });

  const removedChunksCount = chunks.length - validChunks.length;

  if (missingCount > 0 || removedChunksCount > 0) {
    fs.writeFileSync(CHUNKS_PATH, JSON.stringify(validChunks, null, 2));
    console.log(`Synced: added ${missingCount} missing documents, removed ${removedChunksCount} orphaned chunks.`);
    // Mutate the original reference for the caller count
    chunks.length = 0;
    chunks.push(...validChunks);
  } else {
    console.log("All scraped documents are already chunked and no orphaned chunks found.");
  }

  return {
    scrapedCount: scrapedDocs.length,
    startingChunksCount,
    endingChunksCount: chunks.length,
    missingDocumentsFixed: missingCount
  };
}

async function main() {
  if (require.main === module) {
    console.log("Starting sync...");
    const result = await syncScrapedDocumentsToChunks();
    console.log("Sync Result:", result);
  }
}

main().catch(console.error);
