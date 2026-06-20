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

  if (missingCount > 0) {
    fs.writeFileSync(CHUNKS_PATH, JSON.stringify(chunks, null, 2));
    console.log(`Synced ${missingCount} missing documents.`);
  } else {
    console.log("All scraped documents are already chunked.");
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
