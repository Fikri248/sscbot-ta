export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
export const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

export type ChatSource = {
  document_title?: string;
  file_name?: string;
  file_url?: string;
  chunk_index?: number;
  title?: string;
  url?: string | null;
  score?: number;
};

export const NGROK_HEADERS = {
  "ngrok-skip-browser-warning": "true",
};

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = { ...NGROK_HEADERS };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function requestJson(url: string, options: RequestInit = {}) {
  const customHeaders: Record<string, string> = { ...NGROK_HEADERS };
  if (options.headers) {
    Object.assign(customHeaders, options.headers);
  }
  
  const customOptions: RequestInit = {
    ...options,
    headers: customHeaders,
  };

  const response = await fetch(url, customOptions);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Request ke backend gagal.");
  }

  return data;
}

function normalizeFileUrl(url?: string | null) {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;
  return `${BACKEND_BASE_URL}${url}`;
}

function mapSourcesToOldFrontendFormat(sources: any[] = []): ChatSource[] {
  if (!Array.isArray(sources)) return [];

  return sources.map((source, index) => ({
    document_title:
      source.document_title ||
      source.documentTitle ||
      source.title ||
      source.file_name ||
      "Dokumen sumber",
    file_name:
      source.file_name ||
      source.fileName ||
      source.title ||
      source.documentTitle ||
      "Dokumen sumber",
    file_url: normalizeFileUrl(source.file_url || source.fileUrl || source.url),
    chunk_index: source.chunk_index || source.chunkIndex || index + 1,
    title: source.title || source.documentTitle || source.file_name,
    url: normalizeFileUrl(source.url || source.file_url || source.fileUrl) || null,
    score: source.score,
  }));
}

export async function startChat(name?: string, phone?: string) {
  const data = await requestJson(`${API_BASE_URL}/chat/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: name || "User SSC",
      phone: phone || "081234567890",
    }),
  });

  const sessionId =
    data.sessionId ||
    data.chatSessionId ||
    data.id ||
    data.session?.id ||
    data.session?.sessionId ||
    data.data?.sessionId ||
    data.data?.chatSessionId ||
    data.data?.id ||
    `session-${Date.now()}`;

  const userId =
    data.userId ||
    data.user?.id ||
    data.data?.user?.id ||
    `user-${Date.now()}`;

  return {
    status: "success",
    success: true,
    message: data.message || "Sesi chat berhasil dimulai.",
    data: {
      user: { id: userId, name: name || "User SSC", phone: phone || "081234567890" },
      session: { id: sessionId, sessionId, title: "Chat Tugas Akhir" },
    },
    user: { id: userId, name: name || "User SSC", phone: phone || "081234567890" },
    session: { id: sessionId, sessionId, title: "Chat Tugas Akhir" },
    sessionId,
  };
}

export async function startChatSession(name?: string, phone?: string) {
  return startChat(name, phone);
}

export async function sendChatMessage(userId: string, sessionId: string, message: string) {
  const data = await requestJson(`${API_BASE_URL}/chat/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, sessionId, message }),
  });

  const answer = data.answer || data.message || "Maaf, saya belum mendapatkan jawaban dari backend.";

  return {
    status: data.success === false ? "error" : "success",
    success: data.success ?? true,
    message: answer,
    data: {
      answer,
      sources: mapSourcesToOldFrontendFormat(data.sources || []),
      action: data.action || null,
      showSources: Boolean(data.showSources),
      sessionId: data.sessionId || sessionId,
    },
    answer,
    sources: mapSourcesToOldFrontendFormat(data.sources || []),
    action: data.action || null,
    showSources: Boolean(data.showSources),
    sessionId: data.sessionId || sessionId,
  };
}

export async function sendMessage(userId: string, sessionId: string, message: string) {
  return sendChatMessage(userId, sessionId, message);
}

export async function getChatHistory(sessionId?: string) {
  const url = sessionId
    ? `${API_BASE_URL}/chat/history?sessionId=${sessionId}`
    : `${API_BASE_URL}/chat/history`;

  const data = await requestJson(url);

  return {
    status: "success",
    success: true,
    data,
    messages: data.messages || [],
  };
}

export async function clearChatHistory(sessionId?: string) {
  const url = sessionId
    ? `${API_BASE_URL}/chat/history?sessionId=${sessionId}`
    : `${API_BASE_URL}/chat/history`;

  const data = await requestJson(url, { method: "DELETE" });

  return {
    status: "success",
    success: true,
    data,
  };
}

export async function getDocuments() {
  const data = await requestJson(`${API_BASE_URL}/documents`, { headers: getAuthHeaders() });

  return {
    status: "success",
    success: true,
    documents: data.documents || [],
    data,
  };
}

export async function uploadDocument(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const data = await requestJson(`${API_BASE_URL}/documents/upload`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
  });

  return {
    status: "success",
    success: true,
    data,
  };
}

export async function deleteDocument(id: string) {
  const data = await requestJson(`${API_BASE_URL}/documents/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  return {
    status: "success",
    success: true,
    data,
  };
}

export async function getAdminDatasets() {
  const data = await requestJson(`${API_BASE_URL}/admin/datasets`, { headers: getAuthHeaders() });

  return {
    status: "success",
    success: true,
    data: data.data || [],
  };
}

export async function deleteAdminDataset(id: string) {
  const data = await requestJson(`${API_BASE_URL}/admin/datasets/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  return {
    status: "success",
    success: true,
    data,
  };
}

export async function syncAdminDataset() {
  const data = await requestJson(`${API_BASE_URL}/admin/sync`, {
    method: "POST",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  return {
    status: "success",
    success: true,
    data,
  };
}

export async function getAdminSyncStatus() {
  const data = await requestJson(`${API_BASE_URL}/admin/sync/status`, { headers: getAuthHeaders() });

  return {
    status: "success",
    success: true,
    data: data.data,
  };
}

export async function createSupportRequest(payload: {
  name: string;
  nim: string;
  prodi: string;
  phone: string;
  problem?: string;
}) {
  const data = await requestJson(`${API_BASE_URL}/support/requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return {
    status: "success",
    success: true,
    data,
  };
}

export const createChatSession = startChat;
export const createSession = startChat;
export const initChatSession = startChat;

export const sendChat = sendChatMessage;
export const askChatbot = sendChatMessage;

export const fetchChatHistory = getChatHistory;
export const resetChatHistory = clearChatHistory;

export const fetchDocuments = getDocuments;
export const getLibrary = getDocuments;
export const uploadFile = uploadDocument;
export const removeDocument = deleteDocument;

export default {
  startChat,
  startChatSession,
  createChatSession,
  createSession,
  initChatSession,

  sendChatMessage,
  sendMessage,
  sendChat,
  askChatbot,

  getChatHistory,
  fetchChatHistory,
  clearChatHistory,
  resetChatHistory,

  getDocuments,
  fetchDocuments,
  getLibrary,
  uploadDocument,
  uploadFile,
  deleteDocument,
  removeDocument,

  getAdminDatasets,
  deleteAdminDataset,
  syncAdminDataset,
  getAdminSyncStatus,

  createSupportRequest,
};