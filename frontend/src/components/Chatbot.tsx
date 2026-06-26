import { useEffect, useRef, useState, useMemo } from "react";
import type { FormEvent } from "react";
import {
  startChat as startBackendChat,
  sendChatMessage as sendBackendChatMessage,
  getChatHistory as getBackendChatHistory
} from "../services/sscApi";
import { Loader2, Plus, Search, Trash2, Menu, X, ArrowUp, LogOut, Copy, RefreshCw, Edit2 } from "lucide-react";

type ChatbotProps = {
  onLogout?: () => void;
};

type ChatSource = {
  title?: string;
  url?: string | null;
  domain?: string;
  snippet?: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  sources?: ChatSource[];
};

type BackendSession = {
  userId: string;
  sessionId: string;
};

type HistorySession = {
  sessionId: string;
  title: string;
  preview: string;
  messageCount: number;
  updatedAt: string;
};

function renderMessageContent(content: string) {
  const lines = content.split('\n');
  const urlRegex = /(https?:\/\/[^\s]+)/g;

  return lines.map((line, idx) => {
    if (!line.trim()) {
      return <br key={idx} />;
    }

    const match = line.match(urlRegex);
    if (match) {
      const parts = line.split(urlRegex);
      return (
        <p key={idx} className="mb-3 last:mb-0 leading-relaxed max-w-full" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
          {parts.map((part, pIdx) => {
            if (part.match(urlRegex)) {
              return (
                <span key={pIdx} className="block mt-2 mb-2">
                  <a
                    href={part}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#DC2626] text-white text-sm font-bold border-2 border-[#111827] shadow-[2px_2px_0px_#111827] hover:-translate-y-[1px] hover:shadow-[3px_3px_0px_#111827] transition-all no-underline"
                  >
                    Buka Link
                  </a>
                </span>
              );
            }
            return <span key={pIdx}>{part}</span>;
          })}
        </p>
      );
    }

    return (
      <p key={idx} className="mb-2 last:mb-0 leading-relaxed whitespace-pre-wrap max-w-full" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
        {line}
      </p>
    );
  });
}

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function createChatTitle(message: string) {
  const cleanMessage = message.replace(/\s+/g, " ").trim();
  if (!cleanMessage) return "Obrolan Baru";
  if (cleanMessage.length <= 70) return cleanMessage;
  return cleanMessage.slice(0, 70).trim() + "...";
}

function groupHistory(history: HistorySession[]) {
  const groups: { label: string; items: HistorySession[] }[] = [
    { label: "Hari Ini", items: [] },
    { label: "Kemarin", items: [] },
    { label: "7 Hari Terakhir", items: [] },
    { label: "Bulan Ini", items: [] },
    { label: "Lebih Lama", items: [] }
  ];

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const last7Days = today - 86400000 * 7;
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  history.forEach(item => {
    const time = new Date(item.updatedAt).getTime();
    if (time >= today) groups[0].items.push(item);
    else if (time >= yesterday) groups[1].items.push(item);
    else if (time >= last7Days) groups[2].items.push(item);
    else if (time >= thisMonth) groups[3].items.push(item);
    else groups[4].items.push(item);
  });

  return groups.filter(g => g.items.length > 0);
}

function Chatbot({ onLogout }: ChatbotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatTitle, setChatTitle] = useState("Obrolan Baru");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [backendSession, setBackendSession] = useState<BackendSession | null>(null);
  
  const [historyList, setHistoryList] = useState<HistorySession[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);

  const username = localStorage.getItem("username") || "User SSC";
  const initials = username.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const hasMessages = messages.length > 0;
  const canSend = input.trim().length > 0 && !isLoading;

  useEffect(() => {
    document.title = "SSC Chatbot";
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, error]);

  useEffect(() => {
    const manifestKey = `ssc_history_sessions_${username}`;
    const stored = localStorage.getItem(manifestKey);
    if (stored) {
      try {
        setHistoryList(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, [username]);

  function saveHistoryManifest(newList: HistorySession[]) {
    const manifestKey = `ssc_history_sessions_${username}`;
    localStorage.setItem(manifestKey, JSON.stringify(newList));
    setHistoryList(newList);
  }

  function updateCurrentSessionHistory(msgs: ChatMessage[], title: string, bSession: BackendSession) {
    if (msgs.length === 0) return;
    const lastMsg = msgs[msgs.length - 1];
    
    const sessionData: HistorySession = {
      sessionId: bSession.sessionId,
      title: title,
      preview: lastMsg.content.substring(0, 50) + "...",
      messageCount: msgs.length,
      updatedAt: lastMsg.createdAt
    };

    const currentList = [...historyList];
    const existingIndex = currentList.findIndex(h => h.sessionId === bSession.sessionId);
    
    if (existingIndex >= 0) {
      currentList[existingIndex] = sessionData;
    } else {
      currentList.unshift(sessionData);
    }
    
    currentList.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    saveHistoryManifest(currentList);
  }

  const backendSessionRef = useRef<BackendSession | null>(null);

  async function getOrCreateBackendSession() {
    if (backendSessionRef.current) return backendSessionRef.current;
    const startResult = await startBackendChat(username, "081234567890");
    if (!startResult?.data?.user?.id || !startResult?.data?.session?.id) {
      throw new Error("Gagal membuat session chat di backend.");
    }
    const newSession = {
      userId: startResult.data.user.id,
      sessionId: startResult.data.session.id,
    };
    backendSessionRef.current = newSession;
    setBackendSession(newSession);
    return newSession;
  }

  function mapBackendSources(sources: any[]): ChatSource[] {
    if (!Array.isArray(sources)) return [];

    return sources.map((source) => ({
      title:
        source.title ||
        source.document_title ||
        source.documentTitle ||
        source.file_name ||
        source.fileName ||
        "Dokumen sumber",
      url:
        source.url ||
        source.file_url ||
        source.fileUrl ||
        source.documentUrl ||
        null,
      domain: "Dokumen Akademik TUS",
      snippet: source.chunk_index
        ? `Bagian dokumen/chunk ${source.chunk_index}`
        : undefined,
    }));
  }

  async function askBackend(messageText: string) {
    const session = await getOrCreateBackendSession();
    const backendResponse = await sendBackendChatMessage(
      session.userId,
      session.sessionId,
      messageText,
    );
    if (backendResponse?.status === "error") {
      throw new Error(backendResponse.message || "Backend gagal memproses pesan.");
    }
    return {
      answer: backendResponse?.data?.answer || backendResponse?.message || "Maaf, saya belum mendapatkan jawaban dari backend.",
      sources: mapBackendSources(backendResponse?.data?.sources),
    };
  }

  async function sendMessage(messageText: string, baseMessages?: ChatMessage[]) {
    const cleanMessage = messageText.trim();
    if (!cleanMessage || isLoading) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: cleanMessage,
      createdAt: new Date().toISOString(),
    };

    const nextMessages = [...(baseMessages || messages), userMessage];
    setMessages(nextMessages);
    setInput("");
    setError("");
    setIsLoading(true);

    let currentTitle = chatTitle;
    if (!hasMessages) {
      currentTitle = createChatTitle(cleanMessage);
      setChatTitle(currentTitle);
    }

    try {
      const backendResult = await askBackend(cleanMessage);
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: backendResult.answer,
        createdAt: new Date().toISOString(),
        sources: backendResult.sources,
      };
      
      const finalMessages = [...nextMessages, assistantMessage];
      setMessages(finalMessages);
      
      const currentSession = await getOrCreateBackendSession();
      updateCurrentSessionHistory(finalMessages, currentTitle, currentSession);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat menghubungi backend.");
    } finally {
      setIsLoading(false);
    }
  }

  function submitInput() {
    if (editingMessageIndex !== null) {
      const keptMessages = messages.slice(0, editingMessageIndex);
      setEditingMessageIndex(null);
      void sendMessage(input, keptMessages);
    } else {
      void sendMessage(input);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitInput();
  }

  function handleNewChat() {
    setMessages([]);
    setInput("");
    setError("");
    setIsLoading(false);
    setChatTitle("Obrolan Baru");
    setBackendSession(null);
    backendSessionRef.current = null;
    setIsSidebarOpen(false);
    setEditingMessageIndex(null);
  }

  async function handleLoadHistory(sessionId: string) {
    handleNewChat();
    setIsLoading(true);
    setIsSidebarOpen(false);
    try {
      const result = await getBackendChatHistory(sessionId);
      if (result.success && result.messages) {
        const loadedMessages: ChatMessage[] = result.messages.map((m: any) => ({
          role: m.role,
          content: m.content,
          createdAt: m.createdAt || new Date().toISOString(),
          sources: m.sources ? mapBackendSources(m.sources) : []
        }));
        
        setMessages(loadedMessages);
        
        const manifestItem = historyList.find(h => h.sessionId === sessionId);
        if (manifestItem) setChatTitle(manifestItem.title);
        const newSession = { userId: `user-${Date.now()}`, sessionId };
        setBackendSession(newSession);
        backendSessionRef.current = newSession;
      }
    } catch(err) {
      setError("Gagal memuat riwayat chat.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleDeleteHistory(sessionId: string) {
    const newList = historyList.filter(h => h.sessionId !== sessionId);
    saveHistoryManifest(newList);
    setDeleteModalOpen(null);
    if (backendSession?.sessionId === sessionId) {
      handleNewChat();
    }
  }

  function handleCopy(content: string) {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(content);
      setToast("Jawaban berhasil disalin");
      setTimeout(() => setToast(null), 3000);
    }
  }

  function handleRegenerate(index: number) {
    if (isLoading) return;
    const userMessageIndex = index - 1;
    if (userMessageIndex >= 0 && messages[userMessageIndex].role === "user") {
      const prompt = messages[userMessageIndex].content;
      const keptMessages = messages.slice(0, userMessageIndex);
      void sendMessage(prompt, keptMessages);
    }
  }

  function handleEdit(index: number) {
    if (isLoading) return;
    const message = messages[index];
    setInput(message.content);
    setEditingMessageIndex(index);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }

  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return historyList;
    const q = searchQuery.toLowerCase();
    return historyList.filter(h => 
      h.title.toLowerCase().includes(q) || 
      h.preview.toLowerCase().includes(q)
    );
  }, [historyList, searchQuery]);

  const groupedHistory = useMemo(() => groupHistory(filteredHistory), [filteredHistory]);

  const suggestedPrompts = [
    { title: "Pedoman TA", desc: "Aturan TA", prompt: "Apa isi buku pedoman tugas akhir?" },
    { title: "Template TA", desc: "Format penulisan", prompt: "Mana link template buku tugas akhir?" },
    { title: "Pembimbing & Penguji", desc: "Syarat penugasan", prompt: "Apa syarat pembimbing dan penguji tugas akhir?" },
    { title: "Sidang TA", desc: "Daftar sidang", prompt: "Apa saja persyaratan pendaftaran sidang tugas akhir?" },
    { title: "Surat Aktif", desc: "Panduan pengajuan", prompt: "Bagaimana cara mengajukan surat aktif mahasiswa?" },
    { title: "Surat TOSS", desc: "Panduan pengajuan", prompt: "Bagaimana cara mengajukan surat pengantar TOSS?" },
    { title: "Cumlaude", desc: "Kriteria predikat", prompt: "Apa syarat mendapatkan predikat cumlaude?" },
    { title: "Dokumen Penting", desc: "Semua tautan", prompt: "Tampilkan daftar link penting SSC." },
  ];

  return (
    <div className="flex h-screen w-full bg-[#F8FAFC] overflow-hidden font-sans relative">
      
      {toast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[200] bg-[#22C55E] border-2 border-[#111827] text-[#111827] font-bold px-4 py-2 shadow-[4px_4px_0px_#111827] animate-in fade-in slide-in-from-top-5">
          {toast}
        </div>
      )}

      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      <aside className={`fixed lg:static top-0 left-0 z-50 h-full w-[300px] transform transition-transform duration-200 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} flex flex-col bg-[#F8FAFC] border-r-[3px] border-[#111827]`}>
        
        <div className="p-4 border-b-[3px] border-[#111827] flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex-shrink-0 bg-white border-[3px] border-[#111827] rounded-full flex items-center justify-center shadow-[2px_2px_0px_#111827] overflow-hidden">
              <img src="/img/logo_transparent.png" alt="SSC Logo" className="w-8 h-8 object-contain" />
            </div>
            <div className="flex flex-col justify-center">
              <span className="font-black text-lg text-[#111827] leading-none mb-1">SSC Chatbot</span>
              <span className="text-xs font-bold text-gray-500 leading-none">Telkom University Surabaya</span>
            </div>
          </div>
          <button className="lg:hidden p-2 brutalist-button-outline rounded-none" onClick={() => setIsSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          <button onClick={handleNewChat} className="w-full py-3 brutalist-button flex items-center justify-center gap-2 text-lg">
            <Plus className="w-5 h-5" /> Obrolan Baru
          </button>
        </div>

        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input 
              type="text" 
              placeholder="Cari Riwayat..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 brutalist-input"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {groupedHistory.length === 0 ? (
            <div className="text-center text-gray-500 font-bold py-8">
              Riwayat tidak ditemukan
            </div>
          ) : (
            groupedHistory.map(group => (
              <div key={group.label} className="space-y-3">
                <h3 className="font-black text-sm text-[#111827] uppercase tracking-wider">{group.label}</h3>
                {group.items.map(item => (
                  <div key={item.sessionId} className="group relative">
                    <button 
                      onClick={() => handleLoadHistory(item.sessionId)}
                      className={`w-full text-left p-3 brutalist-card hover:-translate-y-1 hover:shadow-[4px_4px_0px_#111827] transition-all ${backendSession?.sessionId === item.sessionId ? 'bg-gray-100' : 'bg-white'}`}
                    >
                      <h4 className="font-bold text-[#111827] truncate pr-8">{item.title}</h4>
                      <p className="text-xs text-gray-600 truncate mt-1">{item.preview}</p>
                      <div className="flex items-center gap-2 mt-2 text-xs font-bold text-gray-500">
                        <span>{item.messageCount} pesan</span>
                        <span>•</span>
                        <span>{formatTime(item.updatedAt)}</span>
                      </div>
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setDeleteModalOpen(item.sessionId); }}
                      className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:text-red-700 bg-white border-2 border-black shadow-[2px_2px_0px_#111827]"
                      title="Hapus Percakapan"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t-[3px] border-[#111827] bg-white">
          <div className="flex items-center justify-between brutalist-card p-3">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 flex-shrink-0 bg-[#DC2626] border-2 border-[#111827] rounded-full flex items-center justify-center text-white font-black shadow-[2px_2px_0px_#111827]">
                {initials}
              </div>
              <div className="truncate">
                <p className="font-bold text-[#111827] truncate">{username}</p>
                <p className="text-xs font-bold text-gray-500">Akun Mahasiswa</p>
              </div>
            </div>
            {onLogout && (
              <button onClick={onLogout} title="Keluar" className="p-2 border-2 border-black hover:bg-gray-100 flex-shrink-0 shadow-[2px_2px_0px_#111827]">
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-[#F8FAFC]">
        <header className="lg:hidden flex items-center justify-between p-4 border-b-[3px] border-[#111827] bg-white">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 brutalist-button-outline">
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="font-black truncate max-w-[200px]">{chatTitle}</h1>
          <div className="w-10"></div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {!hasMessages ? (
            <div className="max-w-4xl mx-auto flex flex-col items-center justify-center min-h-full py-10">
              <div className="w-24 h-24 bg-white border-[4px] border-[#111827] rounded-2xl flex items-center justify-center shadow-[6px_6px_0px_#111827] mb-8 overflow-hidden">
                 <img src="/img/logo_transparent.png" alt="SSC Logo" className="w-16 h-16 object-contain" />
              </div>
              <h2 className="text-3xl md:text-5xl font-black text-center mb-4 uppercase">Selamat Datang di<br/>SSC Chatbot</h2>
              <p className="text-center font-bold text-gray-600 max-w-2xl mb-12 text-lg">
                Tanyakan informasi seputar tugas akhir, surat akademik, sidang, kelulusan, dan pembimbing/penguji.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                {suggestedPrompts.map(s => (
                  <button 
                    key={s.title}
                    onClick={() => void sendMessage(s.prompt)}
                    className="brutalist-card p-4 text-left hover:-translate-y-1 hover:shadow-[6px_6px_0px_#111827]"
                  >
                    <h3 className="font-black text-[#DC2626] mb-1">{s.title}</h3>
                    <p className="text-sm font-bold text-gray-600">{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-8 pb-10">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[85%] group">
                    {m.role === 'user' ? (
                      <div className="flex flex-col items-end">
                        <div className="brutalist-bubble-user relative">
                          {m.content.split("\n").map((line, li) => (
                            <p key={li} className="mb-1 last:mb-0">{line}</p>
                          ))}
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <button 
                            onClick={() => handleEdit(i)}
                            title="Edit Pertanyaan"
                            aria-label="Edit Pertanyaan"
                            className="text-gray-500 hover:text-black flex items-center transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <span className="text-xs font-bold text-gray-500">{formatTime(m.createdAt)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-start">
                        <div className="flex items-center gap-3 mb-2">
                           <div className="w-8 h-8 flex-shrink-0 bg-white rounded-full border-2 border-black flex items-center justify-center overflow-hidden">
                             <img src="/img/logo_transparent.png" alt="SSC Chatbot" className="w-6 h-6 object-contain" />
                           </div>
                           <span className="font-black text-sm uppercase">SSC Chatbot</span>
                        </div>
                        <div className="brutalist-bubble-bot w-full max-w-full overflow-hidden">
                          {renderMessageContent(m.content)}
                          
                          {/* 
                            Visual render for sources has been removed to hide the 
                            "SUMBER / LINK DOKUMEN" block from the UI, as requested. 
                            The source data remains available in m.sources for backend logic.
                          */}
                          
                          {/* Chatbot Actions */}
                          <div className="mt-4 pt-3 border-t-2 border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <button 
                                onClick={() => handleCopy(m.content)}
                                title="Salin Jawaban"
                                className="text-gray-500 hover:text-black flex items-center gap-2 text-sm font-bold transition-colors"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleRegenerate(i)}
                                title="Buat Ulang Jawaban"
                                className="text-gray-500 hover:text-black flex items-center gap-2 text-sm font-bold transition-colors"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                            </div>
                            <span className="text-xs font-bold text-gray-500">{formatTime(m.createdAt)}</span>
                          </div>

                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] flex flex-col items-start">
                    <div className="brutalist-bubble-bot flex items-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="font-bold">Memproses...</span>
                    </div>
                  </div>
                </div>
              )}
              
              {error && (
                <div className="brutalist-card !bg-red-50 !border-red-500 p-4 w-full">
                  <p className="font-bold text-red-600">{error}</p>
                </div>
              )}
              
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="p-4 md:p-6 bg-white border-t-[3px] border-[#111827]">
          <div className="max-w-4xl mx-auto">
            {editingMessageIndex !== null && (
              <div className="flex items-center justify-between mb-3 px-4 py-3 bg-white border-[3px] border-[#111827] shadow-[2px_2px_0px_#111827] rounded-xl flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#DC2626] text-white rounded-lg border-2 border-[#111827]">
                    <Edit2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block font-black text-[#111827] text-sm uppercase">Mode Edit Pertanyaan</span>
                    <span className="block text-xs font-bold text-gray-600">Ubah pertanyaan lalu kirim ulang.</span>
                  </div>
                </div>
                <button 
                  type="button" 
                  onClick={() => {
                    setEditingMessageIndex(null);
                    setInput("");
                  }} 
                  className="text-xs font-bold px-3 py-1.5 bg-white border-2 border-[#111827] text-[#111827] shadow-[2px_2px_0px_#111827] hover:-translate-y-[1px] hover:shadow-[3px_3px_0px_#111827] transition-all whitespace-nowrap"
                >
                  Batal Edit
                </button>
              </div>
            )}
            <form onSubmit={handleSubmit} className="relative flex items-end">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitInput();
                  }
                }}
                placeholder="Tanya apa saja..."
                aria-label="Tanya apa saja..."
                className="w-full pl-4 pr-16 py-4 brutalist-input rounded-xl min-h-[60px] max-h-[200px] resize-none text-lg font-medium"
                rows={1}
              />
              <button 
                type="submit"
                disabled={!canSend}
                className="absolute right-2 bottom-2 w-12 h-12 flex items-center justify-center brutalist-button disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
              >
                <ArrowUp className="w-6 h-6" />
              </button>
            </form>
            <p className="text-center text-xs font-bold text-gray-400 mt-3 uppercase tracking-wide">
              SSC Chatbot dapat membuat kesalahan jadi selalu verifikasi informasi melalui sumber dokumen asli.
            </p>
          </div>
        </div>
      </main>

      {deleteModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="brutalist-card max-w-md w-full p-6">
            <h2 className="text-2xl font-black uppercase mb-2">Hapus Percakapan</h2>
            <p className="font-bold text-gray-600 mb-6">Apakah Anda yakin ingin menghapus percakapan ini? Tindakan ini tidak dapat dibatalkan.</p>
            <div className="flex gap-4 justify-end">
              <button onClick={() => setDeleteModalOpen(null)} className="px-6 py-3 brutalist-button-outline">
                Batal
              </button>
              <button onClick={() => handleDeleteHistory(deleteModalOpen)} className="px-6 py-3 brutalist-button">
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Chatbot;