type ChunkOptions = {
  maxLength?: number;
  overlap?: number;
};

export function chunkText(text: string, options?: ChunkOptions): string[] {
  const maxLength = options?.maxLength ?? 900;
  const overlap = options?.overlap ?? 150;

  const cleanedText = text
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const chunks: string[] = [];

  if (!cleanedText) return chunks;

  let start = 0;

  while (start < cleanedText.length) {
    const end = Math.min(start + maxLength, cleanedText.length);
    const chunk = cleanedText.slice(start, end).trim();

    if (chunk.length > 50) {
      chunks.push(chunk);
    }

    start += maxLength - overlap;

    if (start >= cleanedText.length) {
      break;
    }
  }

  return chunks;
}