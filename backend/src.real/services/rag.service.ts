import { generateEmbedding } from "./embedding.service";

export type DocumentChunk = {
  id: string;
  documentId: string;
  documentTitle: string;
  documentUrl?: string;
  text: string;
  embedding: number[];
};

export type SearchResult = DocumentChunk & {
  score: number;
};

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lexicalBonus(question: string, chunkText: string): number {
  const questionWords = normalizeForSearch(question)
    .split(" ")
    .filter((word) => word.length >= 3);

  const normalizedChunkText = normalizeForSearch(chunkText);

  if (!questionWords.length || !normalizedChunkText) return 0;

  let matchedWords = 0;

  for (const word of questionWords) {
    if (normalizedChunkText.includes(word)) {
      matchedWords++;
    }
  }

  return Math.min(matchedWords / questionWords.length, 1) * 0.15;
}

export async function searchRelevantChunks(
  question: string,
  chunks: DocumentChunk[],
  options?: {
    topK?: number;
    minScore?: number;
  }
): Promise<SearchResult[]> {
  const topK = options?.topK ?? 7;
  const minScore = options?.minScore ?? 0.18;

  if (!question.trim() || !chunks.length) return [];

  const questionEmbedding = await generateEmbedding(question);

  const scoredChunks = chunks
    .map((chunk) => {
      const vectorScore = cosineSimilarity(questionEmbedding, chunk.embedding);
      const bonus = lexicalBonus(question, chunk.text);
      const finalScore = vectorScore + bonus;

      return {
        ...chunk,
        score: finalScore,
      };
    })
    .sort((a, b) => b.score - a.score);

  return scoredChunks
    .filter((chunk) => chunk.score >= minScore)
    .slice(0, topK);
}

export function buildContextFromChunks(chunks: SearchResult[]): string {
  if (!chunks.length) return "";

  return chunks
    .map((chunk) => {
      return `
Judul Dokumen: ${chunk.documentTitle}
Isi:
${chunk.text}
---
`;
    })
    .join("\n");
}

export function getUniqueSources(chunks: SearchResult[]) {
  const sourceMap = new Map<
    string,
    {
      documentId: string;
      title: string;
      url: string | null;
      score: number;
    }
  >();

  for (const chunk of chunks) {
    if (!sourceMap.has(chunk.documentId)) {
      sourceMap.set(chunk.documentId, {
        documentId: chunk.documentId,
        title: chunk.documentTitle,
        url: chunk.documentUrl || null,
        score: Number(chunk.score.toFixed(3)),
      });
    }
  }

  return Array.from(sourceMap.values());
}