import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  startChat as startBackendChat,
  sendChatMessage as sendBackendChatMessage,
} from "../services/sscApi";
import { Loader2 } from "lucide-react";

type ChatbotProps = {
  onLogout?: () => void;
};

type ChatSource = {
  title?: string;
  url?: string;
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

function formatTime(dateString: string) {
  const date = new Date(dateString);

  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function createChatTitle(message: string) {
  const cleanMessage = message.replace(/\s+/g, " ").trim();

  if (!cleanMessage) {
    return "New Chat";
  }

  if (cleanMessage.length <= 70) {
    return cleanMessage;
  }

  return cleanMessage.slice(0, 70).trim() + "...";
}

function Chatbot({ onLogout }: ChatbotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatTitle, setChatTitle] = useState("New Chat");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [backendSession, setBackendSession] = useState<BackendSession | null>(
    null,
  );

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const hasMessages = messages.length > 0;
  const canSend = input.trim().length > 0 && !isLoading;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, error]);

  async function getOrCreateBackendSession() {
    if (backendSession) {
      return backendSession;
    }

    const startResult = await startBackendChat("User SSC", "081234567890");

    if (!startResult?.data?.user?.id || !startResult?.data?.session?.id) {
      throw new Error("Gagal membuat session chat di backend.");
    }

    const newSession = {
      userId: startResult.data.user.id,
      sessionId: startResult.data.session.id,
    };

    setBackendSession(newSession);

    return newSession;
  }

  function mapBackendSources(sources: any[]): ChatSource[] {
    if (!Array.isArray(sources)) {
      return [];
    }

    return sources.map((source) => ({
      title: source.document_title || source.file_name || "Dokumen sumber",
      url: source.file_url,
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
      throw new Error(
        backendResponse.message || "Backend gagal memproses pesan.",
      );
    }

    return {
      answer:
        backendResponse?.data?.answer ||
        "Maaf, saya belum mendapatkan jawaban dari backend.",
      sources: mapBackendSources(backendResponse?.data?.sources),
    };
  }

  async function sendMessage(messageText: string) {
    const cleanMessage = messageText.trim();

    if (!cleanMessage || isLoading) {
      return;
    }

    const userMessage: ChatMessage = {
      role: "user",
      content: cleanMessage,
      createdAt: new Date().toISOString(),
    };

    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setError("");
    setIsLoading(true);

    if (!hasMessages) {
      setChatTitle(createChatTitle(cleanMessage));
    }

    try {
      const backendResult = await askBackend(cleanMessage);

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: backendResult.answer,
        createdAt: new Date().toISOString(),
        sources: backendResult.sources,
      };

      setMessages([...nextMessages, assistantMessage]);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat menghubungi backend.";

      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  function handleNewChat() {
    setMessages([]);
    setInput("");
    setError("");
    setIsLoading(false);
    setChatTitle("New Chat");
    setBackendSession(null);
  }

  function handlePromptClick(prompt: string) {
    void sendMessage(prompt);
  }

  function handleCopyMessage(content: string) {
    if (!navigator.clipboard) {
      return;
    }

    void navigator.clipboard.writeText(content);
  }

  const suggestedPrompts = [
    {
      title: "Tugas Akhir",
      description: "Persyaratan dan prosedur TA",
      prompt: "Bagaimana cara persiapan tugas akhir?",
    },
    {
      title: "Sidang TA",
      description: "Syarat pendaftaran sidang",
      prompt: "Apa saja persyaratan pendaftaran sidang tugas akhir?",
    },
    {
      title: "SK Tugas Akhir",
      description: "Pembaruan atau perpanjangan SK",
      prompt: "Bagaimana cara mengurus perpanjangan SK tugas akhir?",
    },
    {
      title: "Surat Aktif",
      description: "Pengajuan surat aktif mahasiswa",
      prompt: "Bagaimana cara mengajukan surat keterangan aktif mahasiswa?",
    },
    {
      title: "Surat Pengantar TOSS",
      description: "Prosedur surat pengantar",
      prompt: "Bagaimana cara mengajukan surat pengantar TOSS?",
    },
    {
      title: "Cumlaude",
      description: "Syarat predikat kelulusan",
      prompt: "Apa saja syarat cumlaude dan summa cumlaude?",
    },
  ];

  return (
    <div className={`chatbot-shell ${hasMessages ? "is-chat" : "is-welcome"}`}>
      {isSidebarOpen && (
        <button
          type="button"
          className="chatbot-backdrop"
          aria-label="Close sidebar"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`chatbot-sidebar ${isSidebarOpen ? "is-open" : ""}`}>
        <div className="sidebar-brand">
          <img
            src="/img/logo.png"
            alt="SSC ChatBot logo"
            className="moviebot-logo"
          />
          <div>
            <p className="brand-name">SSC ChatBot</p>
            <p className="brand-subtitle">Kelompok 4 (IS-06-03)</p>
          </div>

          {isSidebarOpen && (
            <button
              type="button"
              className="sidebar-close"
              aria-label="Close sidebar"
              onClick={() => setIsSidebarOpen(false)}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                chevron_left
              </span>
            </button>
          )}
        </div>

        <nav className="sidebar-nav" aria-label="Chat navigation">
          <button
            type="button"
            className={`sidebar-link ${!hasMessages ? "active" : ""}`}
            onClick={handleNewChat}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              add_circle
            </span>
            New Chat
          </button>

          <button type="button" className="sidebar-link">
            <span className="material-symbols-outlined" aria-hidden="true">
              history
            </span>
            History
          </button>

          <button type="button" className="sidebar-link">
            <span className="material-symbols-outlined" aria-hidden="true">
              auto_awesome_motion
            </span>
            Library
          </button>

          <button type="button" className="sidebar-link">
            <span className="material-symbols-outlined" aria-hidden="true">
              grid_view
            </span>
            Workspace
          </button>
        </nav>

        <div className="sidebar-profile-wrap">
          <button type="button" className="sidebar-profile">
            <div className="profile-avatar" aria-hidden="true">
              MF
            </div>
            <div>
              <p className="profile-name">Mohamad Fikri</p>
              <p className="profile-type">Personal Account</p>
            </div>
            <span
              className="material-symbols-outlined profile-more"
              aria-hidden="true"
            >
              more_horiz
            </span>
          </button>

          {onLogout && (
            <button
              type="button"
              className="sidebar-link"
              onClick={onLogout}
              style={{ marginTop: "12px" }}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                logout
              </span>
              Logout
            </button>
          )}
        </div>
      </aside>

      <main className={`chatbot-main ${hasMessages ? "is-chat" : "is-welcome"}`}>
        {hasMessages && (
          <header className="chat-header">
            <div className="chat-header-title">
              <button
                type="button"
                className="mobile-menu-button"
                aria-label="Open sidebar"
                onClick={() => setIsSidebarOpen(true)}
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  menu
                </span>
              </button>
              <h1 title={chatTitle}>{chatTitle}</h1>
            </div>

            <div className="chat-header-actions" aria-label="Chat actions">
              <button type="button" aria-label="Download chat">
                <span className="material-symbols-outlined" aria-hidden="true">
                  download
                </span>
              </button>
              <button type="button" aria-label="Share chat">
                <span className="material-symbols-outlined" aria-hidden="true">
                  share
                </span>
              </button>
              <button type="button" aria-label="Pin chat">
                <span className="material-symbols-outlined" aria-hidden="true">
                  push_pin
                </span>
              </button>
            </div>
          </header>
        )}

        <section className="chat-content" aria-live="polite">
          {!hasMessages ? (
            <div className="welcome-panel">
              <button
                type="button"
                className="mobile-menu-button welcome-menu-button"
                aria-label="Open sidebar"
                onClick={() => setIsSidebarOpen(true)}
              >
                Menu
              </button>

              <div className="welcome-heading">
                <img
                  src="/img/logo.png"
                  alt="SSC ChatBot logo"
                  className="welcome-icon moviebot-logo-large"
                />
                <h2>Welcome to SSC ChatBot</h2>
                <p>
                  Halo! Saya asisten pintar SSC. Silakan tanyakan informasi
                  seputar tugas akhir, administrasi akademik, surat mahasiswa,
                  sidang, dan layanan kemahasiswaan berdasarkan dokumen yang
                  tersedia.
                </p>
              </div>

              <div className="prompt-grid">
                {suggestedPrompts.map((suggestion) => (
                  <button
                    type="button"
                    className="prompt-card"
                    key={suggestion.title}
                    onClick={() => handlePromptClick(suggestion.prompt)}
                    disabled={isLoading}
                  >
                    <span>{suggestion.title}</span>
                    <small>{suggestion.description}</small>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="message-list">
              <div className="date-divider">
                <span>Today</span>
              </div>

              {messages.map((message, index) => (
                <article
                  className={`message-row ${message.role}`}
                  key={`${message.role}-${index}`}
                >
                  <div className="message-stack">
                    <div className="message-bubble">
                      {message.content.split("\n").map((line, lineIndex) => (
                        <p key={`${index}-${lineIndex}`}>{line}</p>
                      ))}

                      {message.role === "assistant" &&
                        message.sources &&
                        message.sources.length > 0 && (
                          <div className="message-sources">
                            <div className="message-sources-title">
                              Sources
                            </div>

                            <div className="message-source-list">
                              {message.sources.map((source, sourceIndex) =>
                                source.url ? (
                                  <a
                                    className="message-source-card"
                                    href={source.url}
                                    key={`${source.title}-${sourceIndex}`}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <span
                                      className="message-source-icon"
                                      aria-hidden="true"
                                    >
                                      <span className="material-symbols-outlined">
                                        description
                                      </span>
                                    </span>

                                    <span className="message-source-text">
                                      <span className="message-source-title">
                                        {source.title || "Dokumen sumber"}
                                      </span>
                                      {source.domain && (
                                        <span className="message-source-domain">
                                          {source.domain}
                                        </span>
                                      )}
                                      {source.snippet && (
                                        <span className="message-source-snippet">
                                          {source.snippet}
                                        </span>
                                      )}
                                    </span>

                                    <span
                                      className="material-symbols-outlined message-source-open"
                                      aria-hidden="true"
                                    >
                                      open_in_new
                                    </span>
                                  </a>
                                ) : (
                                  <div
                                    className="message-source-card"
                                    key={`${source.title}-${sourceIndex}`}
                                  >
                                    <span
                                      className="message-source-icon"
                                      aria-hidden="true"
                                    >
                                      <span className="material-symbols-outlined">
                                        description
                                      </span>
                                    </span>

                                    <span className="message-source-text">
                                      <span className="message-source-title">
                                        {source.title || "Dokumen sumber"}
                                      </span>
                                      {source.domain && (
                                        <span className="message-source-domain">
                                          {source.domain}
                                        </span>
                                      )}
                                      {source.snippet && (
                                        <span className="message-source-snippet">
                                          {source.snippet}
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        )}
                    </div>

                    <div className="message-meta">
                      <span>{formatTime(message.createdAt)}</span>

                      <button
                        type="button"
                        aria-label="Copy message"
                        onClick={() => handleCopyMessage(message.content)}
                      >
                        <span
                          className="material-symbols-outlined"
                          aria-hidden="true"
                        >
                          content_copy
                        </span>
                      </button>
                    </div>
                  </div>
                </article>
              ))}

              {isLoading && (
                <article className="message-row assistant">
                  <div className="message-stack">
                    <div className="message-bubble" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <p>Sedang memproses...</p>
                    </div>
                  </div>
                </article>
              )}

              {error && (
                <div className="chat-error">
                  <p>{error}</p>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </section>

        <div className="composer-wrap">
          <div className="composer-model-row">
            <div className="model-selector-control">
              <button
                type="button"
                className="model-selector-trigger"
                aria-label="Selected model"
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  memory
                </span>
                <span className="model-selector-label">MODEL</span>
                <div className="model-selector-selection">
                  <span className="model-selector-current">SSC Backend</span>
                  <div className="model-selector-selected-tags">
                    <span className="model-capability-tag">RAG</span>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <form className="composer" onSubmit={handleSubmit}>
            <button
              type="button"
              className="tool-button"
              aria-label="Add attachment"
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                add
              </span>
            </button>

            <textarea
              aria-label="Message SSC ChatBot"
              placeholder="Message SSC ChatBot..."
              value={input}
              rows={1}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage(input);
                }
              }}
            />

            <button
              type="submit"
              className="send-button"
              disabled={!canSend}
              aria-label="Send message"
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                arrow_upward
              </span>
            </button>
          </form>

          <p className="composer-disclaimer">
            SSC ChatBot dapat membuat kesalahan. Verifikasi kembali informasi
            penting melalui dokumen sumber.
          </p>
        </div>
      </main>
    </div>
  );
}

export default Chatbot;