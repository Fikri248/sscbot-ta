import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function isChitchat(message: string): Promise<boolean> {
  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0,
      max_tokens: 10,
      messages: [
        {
          role: "system",
          content: `
Kamu adalah intent classifier.

Tugasmu menentukan apakah user hanya sedang melakukan basa-basi, menyapa, atau bertanya tentang identitasmu (chitchat).

Jawab hanya:
true
atau
false

Jawab true jika user:
- mengucapkan salam (halo, hai, selamat pagi/siang/malam, assalamualaikum)
- berterima kasih (terima kasih, thanks, makasih)
- bertanya siapa kamu (kamu siapa, namamu siapa, who are you)
- basa-basi ringan yang tidak memerlukan pencarian dokumen

Jawab false jika user:
- bertanya fakta
- bertanya informasi spesifik
- bertanya tentang tugas akhir, akademik, syarat, pedoman, dosen, dll.
- meminta dokumen
- memberikan instruksi panjang

Jangan beri penjelasan.
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
    console.error("Chitchat intent classification error:", error);
    return false;
  }
}
