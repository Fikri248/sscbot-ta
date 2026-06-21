const VECTOR_SIZE = 384;

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashString(input: string): number {
  let hash = 2166136261;

  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }

  return Math.abs(hash >>> 0);
}

function addTokenToVector(vector: number[], token: string, weight: number) {
  const index = hashString(token) % VECTOR_SIZE;
  vector[index] += weight;
}

function getCharacterNgrams(word: string): string[] {
  const result: string[] = [];
  const padded = ` ${word} `;

  for (let n = 3; n <= 5; n++) {
    for (let i = 0; i <= padded.length - n; i++) {
      result.push(padded.slice(i, i + n));
    }
  }

  return result;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const normalized = normalizeText(text);
  const vector = new Array(VECTOR_SIZE).fill(0);

  if (!normalized) return vector;

  const words = normalized.split(" ").filter(Boolean);

  for (const word of words) {
    addTokenToVector(vector, `word:${word}`, 2);

    const ngrams = getCharacterNgrams(word);

    for (const ngram of ngrams) {
      addTokenToVector(vector, `ngram:${ngram}`, 0.5);
    }
  }

  for (let i = 0; i < words.length - 1; i++) {
    addTokenToVector(vector, `bigram:${words[i]}_${words[i + 1]}`, 1.5);
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

  if (norm === 0) return vector;

  return vector.map((value) => value / norm);
}