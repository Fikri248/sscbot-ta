import { Request, Response } from "express";
import {
  buildContextFromChunks,
  getUniqueSources,
  searchRelevantChunks,
} from "../services/rag.service";
import {
  generateAnswerWithAI,
  rewriteQuestionForRetrieval,
} from "../services/ai.service";
import { getAllDocumentChunks } from "../services/document.service";
import { isAskingForSource } from "../utils/sourceIntent";
import { isAskingForAdmin } from "../utils/adminIntent";
import { isChitchat } from "../utils/chitchatIntent";
import { resolveOriginalSourceUrl, findMatchingImportantLinks } from "../utils/sourceUrlResolver";

type ChatMessage = {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  sources?: any[];
  action?: string | null;
};

type ChatSession = {
  id: string;
  sessionId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export const chatSessions: ChatSession[] = [];
export const chatMessages: ChatMessage[] = [];

function getMessageFromBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;

  const message = (body as { message?: unknown }).message;

  if (typeof message !== "string") return null;

  const cleanMessage = message.trim();

  if (!cleanMessage) return null;

  return cleanMessage;
}

function getSessionIdFromBody(body: unknown): string {
  if (!body || typeof body !== "object") return "default-session";

  const sessionId = (body as { sessionId?: unknown }).sessionId;

  if (typeof sessionId === "string" && sessionId.trim()) {
    return sessionId.trim();
  }

  return "default-session";
}

function createSession(sessionId?: string): ChatSession {
  const id = sessionId || `session-${Date.now()}`;

  const existing = chatSessions.find((session) => session.sessionId === id);

  if (existing) {
    existing.updatedAt = new Date().toISOString();
    return existing;
  }

  const newSession: ChatSession = {
    id,
    sessionId: id,
    title: "Chat Tugas Akhir",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  chatSessions.push(newSession);

  return newSession;
}

function saveChat(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
  options?: {
    sources?: any[];
    action?: string | null;
  }
) {
  createSession(sessionId);

  chatMessages.push({
    id: `${Date.now()}-${role}-${Math.random().toString(36).slice(2)}`,
    sessionId,
    role,
    content,
    createdAt: new Date().toISOString(),
    sources: options?.sources || [],
    action: options?.action || null,
  });
}

export async function startChatSession(_req: Request, res: Response) {
  const session = createSession();

  return res.status(200).json({
    success: true,
    message: "Sesi chat berhasil dimulai.",
    id: session.id,
    sessionId: session.sessionId,
    chatSessionId: session.sessionId,
    data: {
      id: session.id,
      sessionId: session.sessionId,
      chatSessionId: session.sessionId,
    },
    session,
  });
}

export async function sendChatMessage(req: Request, res: Response) {
  try {
    const cleanMessage = getMessageFromBody(req.body);

    if (!cleanMessage) {
      return res.status(400).json({
        success: false,
        message: "Pesan tidak boleh kosong.",
      });
    }

    const sessionId = getSessionIdFromBody(req.body);

    saveChat(sessionId, "user", cleanMessage);

    const lowerMsg = cleanMessage.toLowerCase();
    
    // 1. Hardcoded Fast-Paths (0 API Calls)
    if (["hai", "halo", "hello", "pagi", "siang", "sore", "malam", "ping", "p"].includes(lowerMsg)) {
      const answer = "Halo! Saya SSC ChatBot, Asisten SSC. Ada yang bisa saya bantu terkait layanan akademik atau tugas akhir?";
      saveChat(sessionId, "assistant", answer, { sources: [] });
      return res.status(200).json({ success: true, sessionId, answer, message: answer, action: null, sources: [], showSources: false });
    }
    if (["kamu siapa", "siapa kamu", "siapa namamu", "identitasmu"].includes(lowerMsg)) {
      const answer = "Saya SSC ChatBot, Asisten SSC yang membantu menjawab pertanyaan akademik berdasarkan dokumen yang tersedia.";
      saveChat(sessionId, "assistant", answer, { sources: [] });
      return res.status(200).json({ success: true, sessionId, answer, message: answer, action: null, sources: [], showSources: false });
    }
    if (["terima kasih", "makasih", "thanks", "thank you", "ok", "oke", "baik", "sip"].includes(lowerMsg)) {
      const answer = "Sama-sama! Jangan ragu untuk bertanya lagi jika ada yang perlu dibantu terkait tugas akhir atau layanan akademik SSC.";
      saveChat(sessionId, "assistant", answer, { sources: [] });
      return res.status(200).json({ success: true, sessionId, answer, message: answer, action: null, sources: [], showSources: false });
    }
    if (["bantu saya", "bantuan", "saya butuh bantuan", "help", "bisa bantu"].includes(lowerMsg)) {
      const answer = "Saya bisa membantu menjawab pertanyaan seputar layanan akademik SSC, tugas akhir, surat aktif mahasiswa, TOSS, cumlaude, kelulusan, dan link dokumen penting. Silakan tanyakan kebutuhan Anda.";
      saveChat(sessionId, "assistant", answer, { sources: [] });
      return res.status(200).json({ success: true, sessionId, answer, message: answer, action: null, sources: [], showSources: false });
    }

    // 1.5 Source Follow-up Fast-Path
    const isSourceFollowUp = (() => {
      const normalized = cleanMessage.toLowerCase();
      const phrases = [
        "mana sumbernya", "mana sumber dokumennya", "sumber dokumennya mana",
        "dari dokumen apa", "dokumen sumbernya apa", "mana link sumber itu",
        "link sumbernya mana", "sumber link", "source", "references", "sumbernya dari mana"
      ];
      return phrases.some(p => normalized.includes(p));
    })();

    if (isSourceFollowUp) {
      const sessionMessages = chatMessages.filter((m) => m.sessionId === sessionId);
      // Remove the very last message which is the current user query, then find last assistant
      const priorMessages = sessionMessages.slice(0, -1);
      const lastAssistantMsg = [...priorMessages].reverse().find((m) => m.role === "assistant");

      if (lastAssistantMsg) {
        const sources = lastAssistantMsg.sources || (lastAssistantMsg as any).metadata?.sources || (lastAssistantMsg as any).extra?.sources;
        
        if (!sources || sources.length === 0) {
          const answer = "Jawaban sebelumnya tidak berasal dari dokumen SSC sehingga tidak memiliki sumber dokumen yang dapat ditampilkan.";
          saveChat(sessionId, "assistant", answer, { sources: [] });
          return res.status(200).json({ success: true, sessionId, answer, message: answer, action: null, sources: [], showSources: false });
        }
        
        const validSources: { title: string, url: string }[] = [];
        sources.forEach((src: any) => {
          const rawUrl = src.url || src.file_url;
          const rawTitle = src.title || src.document_title || "";
          const originalUrl = resolveOriginalSourceUrl(rawTitle, rawUrl);
          if (originalUrl) {
            const cleanTitle = rawTitle.replace(/^\d+[\.\-]+\s*/, "");
            validSources.push({
              title: cleanTitle,
              url: originalUrl
            });
          }
        });

        if (validSources.length === 0) {
          const answer = "Sumber jawaban sebelumnya ditemukan, tetapi tautan sumber belum tersedia.";
          saveChat(sessionId, "assistant", answer, { sources });
          return res.status(200).json({ success: true, sessionId, answer, message: answer, action: null, sources, showSources: false });
        }

        const isLinkFollowUp = cleanMessage.toLowerCase().includes("link");
        let answer = isLinkFollowUp 
          ? "Link sumber yang tersedia:\n\n" 
          : "Sumber jawaban sebelumnya berasal dari:\n\n";
          
        validSources.forEach((src, idx) => {
          answer += `${idx + 1}. ${src.title}\n   Link: ${src.url}\n\n`;
        });
        
        answer = answer.trim();
        
        saveChat(sessionId, "assistant", answer, { sources });
        return res.status(200).json({ success: true, sessionId, answer, message: answer, action: null, sources, showSources: true });
      } else {
        const answer = "Maaf, tidak ada sumber dokumen spesifik dari percakapan sebelumnya.";
        saveChat(sessionId, "assistant", answer, { sources: [] });
        return res.status(200).json({ success: true, sessionId, answer, message: answer, action: null, sources: [], showSources: false });
      }
    }

    // 2. Cheap Local Domain Check
    const hasDomainKeywords = (text: string) => {
      const domainKeywords = [
        "ta", "tugas akhir", "skripsi", "sidang", "seminar", "proposal",
        "bimbingan", "dosen", "akademik", "ssc", "yudisium", "lulus",
        "jadwal", "format", "pedoman", "revisi", "nilai", "ipk", "pembimbing", "penguji",
        "mahasiswa", "surat", "aktif", "pengantar", "toss", "sk", "sks",
        "kelulusan", "cumlaude", "summa", "pendaftaran", "persyaratan", "dokumen", "administrasi", "layanan",
        "link", "tautan", "linktree", "form", "template", "panduan"
      ];
      const normalized = text.toLowerCase();
      return domainKeywords.some(keyword => new RegExp(`\\b${keyword}\\b`, 'i').test(normalized));
    };

    const isDomainRelated = hasDomainKeywords(cleanMessage);

    // 3. Fast-Reject Out-of-Domain (0 API Calls for factual questions)
    if (!isDomainRelated) {
      const hasQuestionWords = /\b(apa|siapa|berapa|kapan|dimana|bagaimana|kenapa|mengapa|cara)\b/i.test(cleanMessage) || cleanMessage.includes('?');
      
      // If it's a clear question or long text but has no domain keywords, drop it instantly (0 API calls)
      if (hasQuestionWords || cleanMessage.length > 30) {
        const answer = "Maaf, saya hanya dapat membantu pertanyaan yang berkaitan dengan layanan akademik atau tugas akhir berdasarkan dokumen yang tersedia.";
        saveChat(sessionId, "assistant", answer, { sources: [] });
        return res.status(200).json({ success: true, sessionId, answer, message: answer, action: null, sources: [], showSources: false });
      }

      // Ambiguous short message. Fallback to chitchat classifier.
      const wantsChitchat = await isChitchat(cleanMessage);
      if (wantsChitchat) {
        const answer = await generateAnswerWithAI({
          question: cleanMessage,
          context: `Kamu adalah SSC ChatBot.
Tugasmu adalah membalas basa-basi (sapaan, terima kasih, pertanyaan identitas) dari user dengan SANGAT SINGKAT.

ATURAN:
1. Maksimal 1-2 kalimat pendek.
2. Jika user menyapa, balas sapaan dan tawarkan bantuan terkait "tugas akhir atau layanan akademik".
3. Jika user bertanya "kamu siapa" atau sejenisnya, WAJIB jawab persis: "Saya SSC ChatBot, Asisten SSC yang membantu menjawab pertanyaan akademik berdasarkan dokumen yang tersedia."
4. Jangan bertele-tele.`,
        });

        saveChat(sessionId, "assistant", answer, { sources: [] });
        return res.status(200).json({ success: true, sessionId, answer, message: answer, action: null, sources: [], showSources: false });
      } else {
        const answer = "Maaf, saya hanya dapat membantu pertanyaan yang berkaitan dengan layanan akademik atau tugas akhir berdasarkan dokumen yang tersedia.";
        saveChat(sessionId, "assistant", answer, { sources: [] });
        return res.status(200).json({ success: true, sessionId, answer, message: answer, action: null, sources: [], showSources: false });
      }
    }

    // 4. Concurrent Intent Checks and Retrieval Rewrite (For valid domain queries)
    const [wantsAdmin, wantsSource, retrievalQuestion] = await Promise.all([
      isAskingForAdmin(cleanMessage),
      isAskingForSource(cleanMessage),
      rewriteQuestionForRetrieval(cleanMessage)
    ]);

    if (wantsAdmin) {
      const answer = "Baik, saya akan mengarahkan kamu untuk menghubungi admin secara langsung. Silakan isi data berikut terlebih dahulu: nama, NIM, prodi, dan nomor telepon.";
      saveChat(sessionId, "assistant", answer, { action: "collect_admin_contact", sources: [] });
      return res.status(200).json({ success: true, sessionId, answer, message: answer, action: "collect_admin_contact", sources: [], showSources: false });
    }

    // 5. Search Relevant Chunks
    const allChunks = await getAllDocumentChunks();

    if (!allChunks.length) {
      const answer = "Maaf, belum ada dokumen tugas akhir yang tersedia. Admin perlu mengunggah atau menyediakan dokumen tugas akhir terlebih dahulu agar saya dapat menjawab pertanyaan.";
      saveChat(sessionId, "assistant", answer, { sources: [] });
      return res.status(200).json({ success: true, sessionId, answer, message: answer, action: null, sources: [], showSources: false });
    }

    const isLinkQuery = (() => {
      const normalized = cleanMessage.toLowerCase();
      return normalized.includes("link penting") ||
        normalized.includes("link ssc") ||
        normalized.includes("tautan ssc") ||
        normalized.includes("tautan penting") ||
        normalized.includes("daftar link") ||
        normalized.includes("daftar tautan") ||
        normalized.includes("mana link") ||
        normalized.includes("linktree") ||
        (normalized.includes("link") && normalized.split(" ").length < 8);
    })();
    
    if (isLinkQuery) {
      const matchedLinks = findMatchingImportantLinks(cleanMessage);
      if (matchedLinks && matchedLinks.length > 0) {
        let answer = "Link sumber yang tersedia:\n\n";
        matchedLinks.forEach((link, idx) => {
          answer += `${idx + 1}. ${link.label}\n   Link: ${link.url}\n\n`;
        });
        answer = answer.trim();
        saveChat(sessionId, "assistant", answer, { sources: [] });
        return res.status(200).json({ success: true, sessionId, answer, message: answer, action: null, sources: [], showSources: false });
      }
    }

    const isSuratAktifQuery = (() => {
      const normalized = cleanMessage.toLowerCase();
      return normalized.includes("surat keaktifan") ||
             normalized.includes("surat aktif") ||
             normalized.includes("keaktifan mahasiswa") ||
             normalized.includes("keterangan aktif") ||
             normalized.includes("surat keterangan aktif");
    })();

    let finalRetrievalQuestion = retrievalQuestion;
    if (isSuratAktifQuery) {
      finalRetrievalQuestion = "panduan pengajuan surat keterangan aktif mahasiswa layanan SSC syarat form pengajuan surat aktif mahasiswa";
    }

    let relevantChunks = await searchRelevantChunks(
      finalRetrievalQuestion,
      allChunks,
      {
        topK: 3,
        minScore: 0.18,
      }
    );

    if (!relevantChunks.length) {
      const answer = "Maaf, saya hanya dapat membantu pertanyaan yang berkaitan dengan layanan akademik atau tugas akhir berdasarkan dokumen yang tersedia.";
      saveChat(sessionId, "assistant", answer, { sources: [] });
      return res.status(200).json({ success: true, sessionId, answer, message: answer, action: null, sources: [], showSources: false });
    }

    const context = buildContextFromChunks(relevantChunks);

    const answer = await generateAnswerWithAI({
      question: cleanMessage,
      context,
      isLinkQuery: false
    });

    const sources = getUniqueSources(relevantChunks);

    saveChat(sessionId, "assistant", answer, {
      sources,
    });

    return res.status(200).json({
      success: true,
      sessionId,
      answer,
      message: answer,
      action: null,
      sources,
      showSources: wantsSource,
    });
  } catch (error) {
    console.error("Chat error:", error);

    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada sistem chatbot.",
    });
  }
}

export async function getChatHistory(req: Request, res: Response) {
  const sessionId =
    typeof req.query.sessionId === "string" ? req.query.sessionId : null;

  const messages = sessionId
    ? chatMessages.filter((message) => message.sessionId === sessionId)
    : chatMessages;

  return res.status(200).json({
    success: true,
    messages,
  });
}

export async function clearChatHistory(req: Request, res: Response) {
  const sessionId =
    typeof req.query.sessionId === "string" ? req.query.sessionId : null;

  if (sessionId) {
    for (let i = chatMessages.length - 1; i >= 0; i--) {
      if (chatMessages[i].sessionId === sessionId) {
        chatMessages.splice(i, 1);
      }
    }
  } else {
    chatMessages.length = 0;
    chatSessions.length = 0;
  }

  return res.status(200).json({
    success: true,
    message: "Riwayat chat berhasil dihapus.",
  });
}