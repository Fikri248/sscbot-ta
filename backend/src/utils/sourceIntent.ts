import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function isAskingForSource(message: string): Promise<boolean> {
  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0,
      max_tokens: 10,
      messages: [
        {
          role: "system",
          content: `
Kamu adalah classifier intent.

Tugasmu hanya menentukan apakah user meminta sumber informasi/dokumen/link/referensi/bukti dari jawaban chatbot.

Jawab hanya dengan:
true
atau
false

Aturan:
- Jawab true jika user ingin melihat sumber, dokumen, file, link, referensi, bukti, asal informasi, atau lampiran.
- Jawab false jika user hanya bertanya isi informasi biasa.
- Jangan menjelaskan alasan.
- Jangan menambahkan kata lain.
`,
        },
        {
          role: "user",
          content: message,
        },
      ],
    });

    const result = completion.choices[0]?.message?.content?.trim().toLowerCase();

    return result === "true";
  } catch (error) {
    console.error("Source intent classification error:", error);
    return false;
  }
}