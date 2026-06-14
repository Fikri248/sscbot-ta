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

const chatSessions: ChatSession[] = [];
const chatMessages: ChatMessage[] = [];

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

    const wantsAdmin = await isAskingForAdmin(cleanMessage);

    if (wantsAdmin) {
      const answer =
        "Baik, saya akan mengarahkan kamu untuk menghubungi admin secara langsung. Silakan isi data berikut terlebih dahulu: nama, NIM, prodi, dan nomor telepon.";

      saveChat(sessionId, "assistant", answer, {
        action: "collect_admin_contact",
        sources: [],
      });

      return res.status(200).json({
        success: true,
        sessionId,
        answer,
        message: answer,
        action: "collect_admin_contact",
        sources: [],
        showSources: false,
      });
    }

    const allChunks = await getAllDocumentChunks();

    if (!allChunks.length) {
      const answer =
        "Maaf, belum ada dokumen tugas akhir yang tersedia. Admin perlu mengunggah atau menyediakan dokumen tugas akhir terlebih dahulu agar saya dapat menjawab pertanyaan.";

      saveChat(sessionId, "assistant", answer, {
        sources: [],
      });

      return res.status(200).json({
        success: true,
        sessionId,
        answer,
        message: answer,
        action: null,
        sources: [],
        showSources: false,
      });
    }

    const wantsSource = await isAskingForSource(cleanMessage);

    const retrievalQuestion = await rewriteQuestionForRetrieval(cleanMessage);

    const relevantChunks = await searchRelevantChunks(
      retrievalQuestion,
      allChunks,
      {
        topK: 7,
        minScore: 0.18,
      }
    );

    if (!relevantChunks.length) {
      const answer =
        "Maaf, saya hanya dapat membantu pertanyaan yang berkaitan dengan tugas akhir berdasarkan dokumen akademik yang tersedia.";

      saveChat(sessionId, "assistant", answer, {
        sources: [],
      });

      return res.status(200).json({
        success: true,
        sessionId,
        answer,
        message: answer,
        action: null,
        sources: [],
        showSources: false,
      });
    }

    const context = buildContextFromChunks(relevantChunks);

    const answer = await generateAnswerWithAI({
      question: cleanMessage,
      context,
    });

    const sources = wantsSource ? getUniqueSources(relevantChunks) : [];

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