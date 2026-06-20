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
import { normalizeQuery } from "../utils/textNormalizer";

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
    const normalizedMessage = normalizeQuery(lowerMsg);
    
    // 1. Hardcoded Fast-Paths (0 API Calls)
    if (["hai", "halo", "hello", "pagi", "siang", "sore", "malam", "ping", "p"].includes(normalizedMessage)) {
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
    if (["bantu saya", "bantuan", "saya butuh bantuan", "help", "bisa bantu"].includes(normalizedMessage)) {
      const answer = "Saya bisa membantu menjawab pertanyaan seputar layanan akademik SSC, tugas akhir, surat aktif mahasiswa, TOSS, cumlaude, kelulusan, dan link dokumen penting. Silakan tanyakan kebutuhan Anda.";
      saveChat(sessionId, "assistant", answer, { sources: [] });
      return res.status(200).json({ success: true, sessionId, answer, message: answer, action: null, sources: [], showSources: false });
    }

    // 1.5 Source Follow-up Fast-Path
    const isSourceFollowUp = (() => {
      const phrases = [
        "mana sumbernya", "mana sumber dokumennya", "sumber dokumennya mana",
        "dari dokumen apa", "dokumen sumbernya apa", "mana link sumber itu",
        "link sumbernya mana", "sumber link", "source", "references", "sumbernya dari mana"
      ];
      return phrases.some(p => normalizedMessage.includes(p));
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

        const isLinkFollowUp = normalizedMessage.includes("link");
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
      return domainKeywords.some(keyword => new RegExp(`\\b${keyword}\\b`, 'i').test(text));
    };

    const isDomainRelated = hasDomainKeywords(normalizedMessage);

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

    // 3.5 Ambiguity Early-Return for short unclear queries
    const hasSignatureIntent =
      normalizedMessage.includes("tanda tangan") ||
      normalizedMessage.includes("ttd");

    const isSidangApprovalIntent = 
      normalizedMessage.includes("sidang") &&
      (normalizedMessage.includes("approval") || normalizedMessage.includes("approve") || normalizedMessage.includes("persetujuan") || normalizedMessage.includes("diizinkan") || normalizedMessage.includes("diijinkan"));

    const isDraftSeminarSignatureIntent = 
      ((normalizedMessage.includes("draft") || normalizedMessage.includes("proposal")) && normalizedMessage.includes("seminar")) ||
      (normalizedMessage.includes("lembar persetujuan") && normalizedMessage.includes("seminar"));

    const isSidangRevisionSignatureQuestion =
      normalizedMessage.includes("sidang") &&
      (normalizedMessage.includes("tanda tangan") || normalizedMessage.includes("ttd") || normalizedMessage.includes("tandatangani") || normalizedMessage.includes("tanda tangani")) &&
      normalizedMessage.includes("pembimbing") &&
      !normalizedMessage.includes("pendaftaran") &&
      !normalizedMessage.includes("approval") &&
      !normalizedMessage.includes("persetujuan") &&
      !normalizedMessage.includes("diizinkan") &&
      !normalizedMessage.includes("diijinkan") &&
      normalizedMessage !== "pembimbing tanda tangan sidang";

    const isYudisiumRevisionSignatureIntent = 
      (normalizedMessage.includes("yudisium") && (normalizedMessage.includes("form revisi") || normalizedMessage.includes("revisi"))) ||
      normalizedMessage === "pembimbing tanda tangan sidang";

    const isFinalBookAfterSidangSignatureIntent =
      normalizedMessage.includes("buku") &&
      (normalizedMessage.includes("tugas akhir") || normalizedMessage.includes("ta")) &&
      (normalizedMessage.includes("setelah sidang") || normalizedMessage.includes("final")) &&
      (normalizedMessage.includes("tanda tangan") || normalizedMessage.includes("menandatangani") || normalizedMessage.includes("ttd"));

    const isLembarPengesahanSignatureIntent =
      normalizedMessage.includes("lembar pengesahan") &&
      (normalizedMessage.includes("pembimbing") || normalizedMessage.includes("tanda tangan") || normalizedMessage.includes("ttd"));

    const isPostSidangRevisionSignatureIntent = 
      hasSignatureIntent &&
      (normalizedMessage.includes("revisi") || (normalizedMessage.includes("setelah sidang") && !isFinalBookAfterSidangSignatureIntent)) &&
      !isYudisiumRevisionSignatureIntent;

    const isAmbiguousDraftIntent = 
      normalizedMessage.includes("draft") &&
      normalizedMessage.includes("sidang") &&
      !normalizedMessage.includes("seminar");

    const isYudisiumRequirementsIntent = 
      normalizedMessage.includes("yudisium") &&
      (normalizedMessage.includes("syarat") || 
       normalizedMessage.includes("persyaratan") || 
       normalizedMessage.includes("lulus") || 
       normalizedMessage.includes("kelulusan") || 
       normalizedMessage.includes("dokumen") || 
       normalizedMessage.includes("berkas"));

    const isSidangScheduleIntent = 
      normalizedMessage.includes("jadwal sidang") ||
      (normalizedMessage.includes("sidang") && 
       (normalizedMessage.includes("kapan") || 
        normalizedMessage.includes("dimulai") || 
        normalizedMessage.includes("jam") || 
        normalizedMessage.includes("waktu") || 
        normalizedMessage.includes("hadir")));

    const isSidangDurationIntent = 
      normalizedMessage.includes("durasi sidang") ||
      (normalizedMessage.includes("berapa lama") && normalizedMessage.includes("sidang"));

    if (isAmbiguousDraftIntent) {
      const answer = "Apakah yang dimaksud draft proposal untuk seminar, atau draft buku TA untuk pendaftaran sidang?";
      saveChat(sessionId, "assistant", answer, { sources: [] });
      return res.status(200).json({ success: true, sessionId, answer, message: answer, action: null, sources: [], showSources: false });
    }

    const hasSpecificSignatureContext =
      normalizedMessage.includes("revisi") ||
      normalizedMessage.includes("yudisium") ||
      normalizedMessage.includes("form") ||
      normalizedMessage.includes("pendaftaran") ||
      normalizedMessage.includes("buku tugas akhir") ||
      isSidangApprovalIntent ||
      isDraftSeminarSignatureIntent ||
      isFinalBookAfterSidangSignatureIntent ||
      isLembarPengesahanSignatureIntent ||
      isYudisiumRevisionSignatureIntent ||
      isPostSidangRevisionSignatureIntent ||
      isSidangRevisionSignatureQuestion;

    if (hasSignatureIntent && !hasSpecificSignatureContext) {
      const answer = "Pertanyaan Anda masih terlalu singkat. Apakah Anda bermaksud menanyakan tanda tangan untuk pendaftaran sidang, pelaksanaan sidang, lembar revisi setelah sidang, atau buku TA final? Mohon tuliskan konteks yang lebih spesifik agar saya dapat memberikan jawaban yang tepat.";
      saveChat(sessionId, "assistant", answer, { sources: [] });
      return res.status(200).json({ success: true, sessionId, answer, message: answer, action: null, sources: [], showSources: false });
    }

    const ambiguousQueries = [
      "revisi ta",
      "revisi tugas akhir",
      "sk ta",
      "sk tugas akhir",
      "yudisium"
    ];
    if (ambiguousQueries.includes(normalizedMessage)) {
      const answer = "Pertanyaan Anda masih terlalu singkat. Apakah Anda bermaksud menanyakan tanda tangan pembimbing untuk revisi Tugas Akhir, pendaftaran sidang, yudisium, atau dokumen lainnya? Mohon tuliskan konteks yang lebih spesifik agar saya dapat memberikan jawaban yang tepat.";
      saveChat(sessionId, "assistant", answer, { sources: [] });
      return res.status(200).json({ success: true, sessionId, answer, message: answer, action: null, sources: [], showSources: false });
    }

    // 4. Concurrent Intent Checks and Retrieval Rewrite (For valid domain queries)
    const [wantsAdmin, wantsSource, retrievalQuestion] = await Promise.all([
      isAskingForAdmin(normalizedMessage),
      isAskingForSource(normalizedMessage),
      rewriteQuestionForRetrieval(normalizedMessage)
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
      const isTemplateDocumentRequest =
        normalizedMessage.includes("template") &&
        (
          normalizedMessage.includes("buku") ||
          normalizedMessage.includes("tugas akhir") ||
          normalizedMessage.includes("ta")
        );

      const isFormatTemplateRequest =
        normalizedMessage.includes("format") &&
        normalizedMessage.includes("buku") &&
        (normalizedMessage.includes("tugas akhir") || normalizedMessage.includes("ta"));

      return normalizedMessage.includes("link penting") ||
        normalizedMessage.includes("link ssc") ||
        normalizedMessage.includes("tautan ssc") ||
        normalizedMessage.includes("tautan penting") ||
        normalizedMessage.includes("daftar link") ||
        normalizedMessage.includes("daftar tautan") ||
        normalizedMessage.includes("mana link") ||
        normalizedMessage.includes("linktree") ||
        isTemplateDocumentRequest ||
        isFormatTemplateRequest ||
        (normalizedMessage.includes("link") && normalizedMessage.split(" ").length < 8);
    })();
    
    if (isLinkQuery) {
      const matchedLinks = findMatchingImportantLinks(normalizedMessage);
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
      return normalizedMessage.includes("surat keaktifan") ||
             normalizedMessage.includes("surat aktif") ||
             normalizedMessage.includes("keaktifan mahasiswa") ||
             normalizedMessage.includes("keterangan aktif") ||
             normalizedMessage.includes("surat keterangan aktif");
    })();

    let finalRetrievalQuestion = retrievalQuestion;
    if (isSuratAktifQuery) {
      finalRetrievalQuestion = "panduan pengajuan surat keterangan aktif mahasiswa layanan SSC syarat form pengajuan surat aktif mahasiswa";
    }

    let chunksForSearch = allChunks;
    
    const isPengujiPembimbingIntent = normalizedMessage.includes("penguji") && normalizedMessage.includes("tugas akhir");
    const isRevisiTtdIntent = hasSignatureIntent && normalizedMessage.includes("revisi");

    if (isPengujiPembimbingIntent) {
      chunksForSearch = allChunks.filter((c) =>
        c.documentTitle.includes("Surat-Edaran-Persyaratan-Pembimbing-dan-Penguji")
      );
    } else if (isYudisiumRevisionSignatureIntent) {
      chunksForSearch = allChunks.filter(c => {
        const t = c.text.toLowerCase();
        return t.includes("form revisi") && t.includes("yudisium") && t.includes("ditandatangan basah");
      });
      if (chunksForSearch.length === 0) {
        chunksForSearch = allChunks.filter(c => c.text.toLowerCase().includes("form revisi") && c.text.toLowerCase().includes("yudisium"));
      }
    } else if (isFinalBookAfterSidangSignatureIntent) {
      chunksForSearch = allChunks.filter(c => {
        const title = c.documentTitle.toLowerCase();
        const t = c.text.toLowerCase();
        return (title.includes("template buku tugas akhir") && t.includes("kaprodi")) || 
               (t.includes("buku tugas akhir final") && t.includes("kaprodi")) ||
               (t.includes("buku ta final") && t.includes("kaprodi"));
      });
      if (chunksForSearch.length === 0) chunksForSearch = allChunks.filter(c => c.text.toLowerCase().includes("buku tugas akhir final"));
    } else if (isLembarPengesahanSignatureIntent) {
      chunksForSearch = allChunks.filter(c => {
        const title = c.documentTitle.toLowerCase();
        const t = c.text.toLowerCase();
        return title.includes("template buku tugas akhir") && t.includes("lembar pengesahan") && t.includes("pembimbing i");
      });
      if (chunksForSearch.length === 0) chunksForSearch = allChunks.filter(c => c.text.toLowerCase().includes("lembar pengesahan"));
    } else if (isDraftSeminarSignatureIntent) {
      chunksForSearch = allChunks.filter(c => {
        const title = c.documentTitle.toLowerCase();
        const t = c.text.toLowerCase();
        return title.includes("buku pedoman tugas akhir") && 
               t.includes("draft proposal") && t.includes("lembar persetujuan");
      });
      if (chunksForSearch.length === 0) {
        chunksForSearch = allChunks.filter(c => c.text.toLowerCase().includes("lembar persetujuan") && c.text.toLowerCase().includes("pembimbing"));
      }
    } else if (isPostSidangRevisionSignatureIntent || isSidangRevisionSignatureQuestion) {
      chunksForSearch = allChunks.filter((c) => {
        const t = c.text.toLowerCase();

        return (
          t.includes("wajib bertandatangan basah oleh pembimbing 1, pembimbing 2, dosen penguji 1, dan dosen penguji 2") ||
          (
            t.includes("lembar revisi") &&
            t.includes("pembimbing 1") &&
            t.includes("pembimbing 2") &&
            t.includes("penguji 1") &&
            t.includes("penguji 2")
          ) ||
          (
            t.includes("form revisi") &&
            t.includes("ditandatangan") &&
            t.includes("pembimbing")
          )
        );
      });

      if (chunksForSearch.length === 0) {
        chunksForSearch = allChunks.filter(c => {
          const t = c.text.toLowerCase();
          const title = c.documentTitle.toLowerCase();

          const relevant =
            t.includes("revisi") ||
            t.includes("form revisi") ||
            t.includes("ditandatangan") ||
            t.includes("tandatangan") ||
            t.includes("tanda tangan");

          const noisy =
            title.includes("pendaftaran sidang") ||
            title.includes("kumpulan_link") ||
            t.includes("dummy ijazah") ||
            t.includes("openlib") ||
            (!normalizedMessage.includes("yudisium") && t.includes("yudisium")) ||
            t.includes("sanksi") ||
            t.includes("diskualifikasi") ||
            t.includes("evaluasi") ||
            t.includes("mengulang sidang");

          return relevant && !noisy;
        });
      }
    } else if (isYudisiumRequirementsIntent) {
      chunksForSearch = allChunks.filter(c => {
        const title = c.documentTitle.toLowerCase();
        const t = c.text.toLowerCase();
        return title.includes("buku pedoman tugas akhir") && 
               (t.includes("pengumpulan persyaratan yudisium dilakukan secara online") ||
                (t.includes("buku tugas akhir versi final") && t.includes("kaprodi")) ||
                (t.includes("surat bebas tunggakan keuangan") && t.includes("basila")));
      });

      if (chunksForSearch.length === 0) {
        chunksForSearch = allChunks.filter(c => {
          const title = c.documentTitle.toLowerCase();
          const t = c.text.toLowerCase();
          return title.includes("buku pedoman tugas akhir") && 
                 (t.includes("persyaratan yudisium") || 
                  t.includes("form revisi") || 
                  t.includes("openlib") || 
                  t.includes("document ta/thesis archived") ||
                  t.includes("buku tugas akhir versi terakhir") ||
                  t.includes("buku tugas akhir versi final") ||
                  t.includes("similarity") || 
                  t.includes("sbkp") || 
                  t.includes("surat bebas kewajiban perpustakaan") || 
                  t.includes("bebas tunggakan") || 
                  t.includes("bebas pinjam laboratorium") || 
                  t.includes("basila") || 
                  t.includes("capture hasil lulus sidang tingkat 3") ||
                  t.includes("cumlaude") ||
                  t.includes("summa-cumlaude"));
        });
      }
    } else if (isSidangDurationIntent) {
      chunksForSearch = allChunks.filter(c => {
        const title = c.documentTitle.toLowerCase();
        const t = c.text.toLowerCase();
        return title.includes("buku pedoman tugas akhir") && 
               (t.includes("90") || 
                t.includes("sembilan puluh") || 
                t.includes("durasi") || 
                t.includes("sidang tugas akhir"));
      });
    } else if (isSidangScheduleIntent) {
      chunksForSearch = allChunks.filter(c => {
        const title = c.documentTitle.toLowerCase();
        const t = c.text.toLowerCase();
        return title.includes("buku pedoman tugas akhir") && 
               (t.includes("hadir maksimal 15 menit") || 
                t.includes("jadwal sidang") || 
                t.includes("dosen penguji") || 
                t.includes("dosen pembimbing") || 
                t.includes("igracias"));
      });
    } else if (isSidangApprovalIntent) {
      chunksForSearch = allChunks.filter((c) => {
        const title = c.documentTitle.toLowerCase();
        return title.includes("pendaftaran sidang") || title.includes("persyaratan pendaftaran");
      });
    } else if (!isLinkQuery) {
      chunksForSearch = allChunks.filter((c) =>
        !c.documentTitle.includes("Kumpulan_Link_Penting_SSC")
      );
    }

    let relevantChunks: any[] = [];
    if (isYudisiumRequirementsIntent) {
      relevantChunks = chunksForSearch.map(c => ({ ...c, score: 1.0 }));
    } else {
      relevantChunks = await searchRelevantChunks(
        finalRetrievalQuestion,
        chunksForSearch,
        {
          topK: 3,
          minScore: 0.18,
        }
      );
    }

    if (!relevantChunks.length) {
      const answer = "Maaf, saya hanya dapat membantu pertanyaan yang berkaitan dengan layanan akademik atau tugas akhir berdasarkan dokumen yang tersedia.";
      saveChat(sessionId, "assistant", answer, { sources: [] });
      return res.status(200).json({ success: true, sessionId, answer, message: answer, action: null, sources: [], showSources: false });
    }

    let context = buildContextFromChunks(relevantChunks);

    if (isYudisiumRevisionSignatureIntent) {
      context = "INSTRUKSI TAMBAHAN: Jelaskan bahwa Form Revisi Tugas Akhir untuk persyaratan Yudisium wajib ditandatangani basah oleh Pembimbing 1, Pembimbing 2, Penguji 1, dan Penguji 2.\n\n" + context;
    } else if (isFinalBookAfterSidangSignatureIntent) {
      context = "INSTRUKSI TAMBAHAN: Jelaskan bahwa Buku Tugas Akhir final harus ditandatangani oleh Pembimbing 1, Pembimbing 2, Penguji 1, Penguji 2, dan Kaprodi.\n\n" + context;
    } else if (isLembarPengesahanSignatureIntent) {
      context = "INSTRUKSI TAMBAHAN: Jelaskan bahwa pada lembar pengesahan terdapat kolom tanda tangan Pembimbing I dan Pembimbing II.\n\n" + context;
    } else if (isDraftSeminarSignatureIntent) {
      context = "INSTRUKSI TAMBAHAN: Jelaskan bahwa Draft Proposal TA untuk seminar wajib disertai Lembar Persetujuan yang ditandatangani basah oleh Pembimbing 1 dan Pembimbing 2.\n\n" + context;
    } else if (isPostSidangRevisionSignatureIntent || isSidangRevisionSignatureQuestion) {
      context = "INSTRUKSI TAMBAHAN: Jawab hanya tentang pihak yang menandatangani lembar/form revisi setelah sidang. Lembar Revisi wajib ditandatangani basah oleh Pembimbing 1, Pembimbing 2, Penguji 1, dan Penguji 2. Jangan membahas proses feedback, sanksi revisi, atau yudisium.\n\n" + context;
    } else if (isYudisiumRequirementsIntent) {
      context = "INSTRUKSI TAMBAHAN: Jawab dengan seluruh poin persyaratan yudisium yang tersedia dalam konteks. Jangan ringkas menjadi sebagian poin. Jika suatu poin ada dalam konteks, wajib tuliskan. Pastikan mencakup: capture hasil lulus sidang tingkat 3 di iGracias, form revisi TA, bukti unggah Openlib, buku TA final, similarity buku TA maksimal 25%, similarity karya ilmiah maksimal 25%, SBKP, surat bebas tunggakan keuangan, surat bebas pinjam laboratorium, Basila, dan persyaratan cumlaude/summa cumlaude jika tersedia.\n\n" + context;
    } else if (isSidangDurationIntent) {
      context = "INSTRUKSI TAMBAHAN: Jawab durasi sidang Tugas Akhir adalah 90 (sembilan puluh) menit. Jangan membahas pendaftaran, revisi, yudisium, atau persyaratan lain.\n\n" + context;
    } else if (isSidangScheduleIntent) {
      context = "INSTRUKSI TAMBAHAN: Pastikan jawaban menyebutkan bahwa seluruh pihak wajib hadir maksimal 15 menit sebelum sidang dimulai dan jadwal Dosen Penguji serta Pembimbing dapat dilihat di akun iGracias masing-masing.\n\n" + context;
    } else if (isSidangApprovalIntent) {
      context = "INSTRUKSI TAMBAHAN: Jawab hanya berdasarkan ketentuan pendaftaran sidang. Jelaskan bahwa pendaftaran sidang membutuhkan approval/persetujuan digital 'Diijinkan Sidang' dari Pembimbing 1 dan Pembimbing 2 di iGracias. Bedakan ini dengan tanda tangan fisik.\n\n" + context;
    }

    const answer = await generateAnswerWithAI({
      question: cleanMessage,
      context,
      isLinkQuery
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