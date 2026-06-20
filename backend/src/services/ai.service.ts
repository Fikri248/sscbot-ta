import Groq from "groq-sdk";
import { TA_SYSTEM_PROMPT } from "../prompts/taPrompt";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

type GenerateAnswerParams = {
  question: string;
  context: string;
  isLinkQuery?: boolean;
};

export async function rewriteQuestionForRetrieval(
  question: string
): Promise<string> {
  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.1,
      max_tokens: 200,
      messages: [
        {
          role: "system",
          content: `
Kamu bertugas merapikan pertanyaan mahasiswa agar lebih mudah dicari pada dokumen layanan akademik SSC.

Aturan:
- Perbaiki typo.
- Ubah singkatan menjadi bentuk yang lebih jelas jika memungkinkan.
- Pertahankan maksud asli user.
- Jangan menjawab pertanyaan.
- Jangan menambahkan informasi baru.
- Output hanya pertanyaan yang sudah dirapikan.
`,
        },
        {
          role: "user",
          content: question,
        },
      ],
    });

    const rewritten = completion.choices[0]?.message?.content?.trim();

    if (!rewritten) {
      return question;
    }

    return `${question}\n${rewritten}`;
  } catch (error) {
    console.error("Rewrite question error:", error);
    return question;
  }
}

export async function generateAnswerWithAI({
  question,
  context,
  isLinkQuery,
}: GenerateAnswerParams): Promise<string> {
  const hasContext = context && context.trim().length > 80;

  if (!hasContext) {
    return "Maaf, saya belum menemukan informasi tersebut pada dokumen yang tersedia. Saya hanya dapat menjawab pertanyaan berdasarkan dokumen akademik yang sudah diunggah.";
  }

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.2,
      max_tokens: isLinkQuery ? 2000 : 1000,
      messages: [
        {
          role: "system",
          content: TA_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: isLinkQuery && context.includes('http') ? `
User sedang mencari daftar link atau tautan SSC.
Konteks daftar link yang tersedia:
${context}

Instruksi jawaban:
- Tampilkan SEMUA link yang ada di dalam konteks.
- Format WAJIB:
  1. Nama layanan: URL
  2. Nama layanan: URL
- JIKA ada link yang tidak ada di konteks, abaikan saja.
- Jangan menambahkan penjelasan tambahan.
- Jangan memotong URL.
- Jangan mengganti URL.
- Jangan membuat link baru.
- Jangan menulis "(tidak tersedia)".
- Jangan menulis "Maaf" atau "Namun".
` : `
Pertanyaan mahasiswa:
${question}

Konteks dokumen yang boleh digunakan untuk menjawab:
${context}

Instruksi jawaban:
- Sintesis seluruh informasi dari konteks menjadi satu jawaban utuh.
- Jika konteks berisi informasi yang relevan, jawab langsung tanpa awalan "Maaf", "Namun", atau "tidak menemukan informasi".
- Gunakan penolakan hanya jika konteks benar-benar kosong atau sama sekali tidak relevan dengan pertanyaan.
- Jangan pernah menyebutkan kata "Konteks", "Dokumen", "Referensi", "Sumber", atau "Chunk".
- Jangan menampilkan URL atau tautan kecuali pengguna secara eksplisit meminta link, tautan, atau sumber.
- Jawab seolah-olah kamu adalah Asisten SSC yang sudah menguasai informasi tersebut dari ingatanmu.
- Jangan mengarang informasi di luar konteks.
- Jika informasi benar-benar tidak ada dalam konteks, katakan bahwa informasi tersebut belum tersedia.
- Buat jawaban rapi, natural, dan mudah dipahami seperti ChatGPT.
`,
        },
      ],
    });

    let rawContent = completion.choices[0]?.message?.content?.trim() || "";
    if (rawContent) {
      rawContent = rawContent
        .replace(/\*\*/g, "")
        .replace(/__/g, "")
        .replace(/^#+\s+/gm, "")
        .replace(/i\s?gadis/gi, "iGracias");

      if (!isLinkQuery) {
        rawContent = rawContent.replace(/[^.\n]*?(https?:\/\/[^\s]+|linktr\.ee[^\s]*)[^.\n]*\.?/gi, "");
        rawContent = rawContent.replace(/\n{3,}/g, "\n\n").trim();
      }
    }

    return rawContent || "Maaf, saya belum dapat membuat jawaban dari dokumen yang tersedia.";
  } catch (error) {
    console.error("Groq AI Service Error:", error);
    return "Maaf, layanan AI sedang mengalami gangguan teknis atau sibuk. Silakan coba beberapa saat lagi.";
  }
}