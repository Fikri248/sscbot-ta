import { DEFAULT_GROQ_MODEL_ID } from "../config/groqModels";
import type { ChatMessage } from "../types/chat";

const CHAT_STORAGE_PREFIX = "moviebot_2026_chat_";
const CHAT_HISTORY_EXPORT_VERSION = 2;

export type SavedChatSession = {
  chatId: string;
  chatTitle: string;
  hasCustomTitle: boolean;
  messages: ChatMessage[];
  model?: string;
  updatedAt: string;
};

export type ChatHistoryExport = {
  version: number;
  exportedAt: string;
  sessions: SavedChatSession[];
};

export const GROQ_MODEL_NAME = DEFAULT_GROQ_MODEL_ID;

function canUseBrowserStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function generateChatId() {
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);

  return `chat_${Date.now().toString(36)}_${randomPart}`;
}

export function getChatIdFromUrl() {
  if (typeof window === "undefined") {
    return null;
  }

  const chatId = new URLSearchParams(window.location.search).get("chat");
  const cleanChatId = chatId?.trim();

  return cleanChatId || null;
}

export function setChatUrl(chatId: string) {
  if (typeof window === "undefined") {
    return;
  }

  const nextUrl = `/?chat=${encodeURIComponent(chatId)}`;

  if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
    window.history.pushState({ chatId }, "", nextUrl);
  }
}

export function resetChatUrl() {
  if (typeof window === "undefined") {
    return;
  }

  if (`${window.location.pathname}${window.location.search}` !== "/") {
    window.history.pushState({}, "", "/");
  }
}

export function getChatStorageKey(chatId: string) {
  return `${CHAT_STORAGE_PREFIX}${chatId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isChatSource(value: unknown) {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.title === undefined || typeof value.title === "string") &&
    (value.url === undefined || typeof value.url === "string") &&
    (value.domain === undefined || typeof value.domain === "string") &&
    (value.snippet === undefined || typeof value.snippet === "string")
  );
}

function isChatImageAttachment(value: unknown) {
  if (!isRecord(value)) {
    return false;
  }

  const validMimeTypes = ["image/png", "image/jpeg", "image/webp"];

  return (
    typeof value.name === "string" &&
    (value.fileName === undefined || typeof value.fileName === "string") &&
    typeof value.dataUrl === "string" &&
    validMimeTypes.includes(value.mimeType as string)
  );
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!isRecord(value)) {
    return false;
  }

  const validRoles: ChatMessage["role"][] = ["system", "user", "assistant"];

  return (
    validRoles.includes(value.role as ChatMessage["role"]) &&
    typeof value.content === "string" &&
    (value.image === undefined || isChatImageAttachment(value.image)) &&
    (value.createdAt === undefined || typeof value.createdAt === "string") &&
    (value.tokens === undefined || typeof value.tokens === "number") &&
    (value.modelId === undefined || typeof value.modelId === "string") &&
    (value.modelName === undefined || typeof value.modelName === "string") &&
    (value.sources === undefined ||
      (Array.isArray(value.sources) && value.sources.every(isChatSource)))
  );
}

function isSavedChatSession(
  value: unknown,
  chatId: string,
): value is SavedChatSession {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.chatId === chatId &&
    typeof value.chatTitle === "string" &&
    typeof value.hasCustomTitle === "boolean" &&
    Array.isArray(value.messages) &&
    value.messages.every(isChatMessage) &&
    (value.model === undefined || typeof value.model === "string") &&
    typeof value.updatedAt === "string"
  );
}

function isExportedChatHistory(value: unknown): value is ChatHistoryExport {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.version === "number" &&
    typeof value.exportedAt === "string" &&
    Array.isArray(value.sessions)
  );
}

function readSavedChatSession(chatId: string) {
  if (!canUseBrowserStorage()) {
    return null;
  }

  try {
    const savedSession = localStorage.getItem(getChatStorageKey(chatId));

    if (!savedSession) {
      return null;
    }

    const parsedSession = JSON.parse(savedSession) as unknown;

    if (!isSavedChatSession(parsedSession, chatId)) {
      return null;
    }

    return parsedSession;
  } catch {
    return null;
  }
}

function getSavedSessionTime(session: SavedChatSession) {
  const lastMessageTime = new Date(
    session.messages.at(-1)?.createdAt ?? "",
  ).getTime();

  if (!Number.isNaN(lastMessageTime)) {
    return lastMessageTime;
  }

  const updatedAt = new Date(session.updatedAt).getTime();

  if (!Number.isNaN(updatedAt)) {
    return updatedAt;
  }

  return 0;
}

export function saveChatSession(session: SavedChatSession) {
  if (!canUseBrowserStorage()) {
    return;
  }

  try {
    localStorage.setItem(
      getChatStorageKey(session.chatId),
      JSON.stringify(session),
    );
  } catch {
    // Ignore storage errors so the chat UI keeps working.
  }
}

export function loadChatSession(chatId: string | null) {
  if (!chatId) {
    return null;
  }

  return readSavedChatSession(chatId);
}

export function getAllSavedChatSessions() {
  if (!canUseBrowserStorage()) {
    return [];
  }

  const sessions: SavedChatSession[] = [];

  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);

      if (!key?.startsWith(CHAT_STORAGE_PREFIX)) {
        continue;
      }

      const chatId = key.replace(CHAT_STORAGE_PREFIX, "");
      const savedSession = readSavedChatSession(chatId);

      if (savedSession) {
        sessions.push(savedSession);
      }
    }
  } catch {
    return [];
  }

  return sessions.sort(
    (firstSession, secondSession) =>
      getSavedSessionTime(secondSession) - getSavedSessionTime(firstSession),
  );
}

export function createChatHistoryExport(): ChatHistoryExport {
  return {
    version: CHAT_HISTORY_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    sessions: getAllSavedChatSessions(),
  };
}

export function parseChatHistoryExport(value: unknown) {
  if (!isExportedChatHistory(value)) {
    return [];
  }

  return value.sessions.filter(
    (session): session is SavedChatSession =>
      isRecord(session) &&
      typeof session.chatId === "string" &&
      isSavedChatSession(session, session.chatId),
  );
}

export function importChatHistorySessions(sessions: SavedChatSession[]) {
  if (!canUseBrowserStorage()) {
    return 0;
  }

  const existingChatIds = new Set(
    getAllSavedChatSessions().map((session) => session.chatId),
  );
  let importCount = 0;

  sessions.forEach((session) => {
    let nextChatId = session.chatId;

    while (existingChatIds.has(nextChatId)) {
      nextChatId = generateChatId();
    }

    existingChatIds.add(nextChatId);
    saveChatSession({
      ...session,
      chatId: nextChatId,
    });
    importCount += 1;
  });

  return importCount;
}

export function deleteChatSession(chatId: string) {
  if (!canUseBrowserStorage()) {
    return;
  }

  try {
    localStorage.removeItem(getChatStorageKey(chatId));
  } catch {
    // Ignore storage errors so the rest of the app remains usable.
  }
}
