import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function isAskingForAdmin(message: string): Promise<boolean> {
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

Tugasmu menentukan apakah user ingin berbicara langsung dengan admin/staf/manusia, bukan dijawab oleh chatbot.

Jawab hanya:
true
atau
false

Jawab true jika user:
- ingin menghubungi admin
- ingin bicara dengan staf
- meminta bantuan manusia
- mengatakan masalahnya ingin diteruskan ke admin
- tidak ingin dijawab bot
- ingin konsultasi langsung

Jawab false jika user hanya bertanya informasi biasa tentang tugas akhir.
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
    console.error("Admin intent classification error:", error);
    return false;
  }
}