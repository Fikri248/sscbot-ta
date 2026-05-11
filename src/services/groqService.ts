import chatbotConfig from "../config/chatbotConfig";
import { DEFAULT_GROQ_MODEL_ID, GROQ_MODEL_IDS } from "../config/groqModels";
import { supportsVision, supportsWebSearch } from "../config/modelCapabilities";
import {
  asksForMovieRecommendation,
  asksForSynopsis,
  buildCompactMovieContext,
  findMovieTitleLookupResult,
  findMoviesByActorQuery,
  getCatalogMoviesPage,
  getFilteredCatalogBrowseLabel,
  getFilteredCatalogBrowseMovies,
  getGenreSummaryMessage,
  getMovieCatalogCount,
  getRelevantMovies,
  isActorLookupIntent,
  isCatalogCountIntent,
  isFilteredCatalogBrowseIntent,
  isCatalogListIntent,
  isCatalogPaginationIntent,
  isGenreSummaryIntent,
  isGreetingOrIdentityPrompt,
  isMoodLiftingMoviePrompt,
  isOutOfScopeMovieBotIntent,
  isSadFilmMoviePrompt,
  isTitleCastIntent,
} from "./movieRetrieval";
import type { ActorLookupResult, TitleLookupResult } from "./movieRetrieval";
import type { Movie } from "../types/movie";
import type { ChatMessage, ChatRole, ChatSource } from "../types/chat";
import movieCatalogJson from "../data/film_indonesia_2026.json";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = DEFAULT_GROQ_MODEL_ID;
const DEFAULT_MAX_COMPLETION_TOKENS = 350;
const COMPOUND_MAX_COMPLETION_TOKENS = 1024;
const GROQ_REQUEST_TIMEOUT_MS = 30_000;
const NORMAL_CHAT_CONTEXT_LIMIT = 6;
const WEB_SEARCH_CONTEXT_LIMIT = 4;
const WEB_SEARCH_ASSISTANT_CONTEXT_LENGTH = 700;
const WEB_SEARCH_USER_CONTEXT_LENGTH = 1200;
const ESTIMATED_CHARS_PER_TOKEN = 4;
const INTERNAL_SOURCE_MARKERS = [
  "browser.search",
  "browser.open",
  "browser.find",
  "browser.click",
  "browser.run",
];
const MOVIEBOT_RULE_MODIFICATION_FALLBACK_MESSAGE =
  "Maaf, saya tidak dapat mengubah aturan, katalog film, atau instruksi utama MovieBot. Saya hanya dapat membantu rekomendasi film Indonesia 2026 dari katalog yang tersedia.";
const MOVIEBOT_WEB_SEARCH_UNNEEDED_MESSAGE =
  "MovieBot praktikum memakai katalog lokal film Indonesia 2026, jadi Web Search tidak diperlukan.";
const MOVIEBOT_OUT_OF_SCOPE_FALLBACK_MESSAGE =
  "Maaf, saya hanya bisa membantu rekomendasi dan informasi film Indonesia tahun 2026 dari katalog MovieBot. Mau saya rekomendasikan film berdasarkan genre atau mood?";
const MOVIEBOT_ACTOR_NOT_FOUND_FALLBACK_MESSAGE =
  "Maaf, saya belum menemukan aktor tersebut di katalog film Indonesia 2026 MovieBot.";
const MOVIEBOT_TITLE_NOT_FOUND_FALLBACK_MESSAGE =
  "Maaf, saya belum menemukan judul film tersebut di katalog MovieBot.";
const UNSUPPORTED_REQUEST_CONFIGURATION_MESSAGE =
  "Model yang dipilih tidak mendukung konfigurasi request ini. Pilih model chat biasa untuk menjalankan MovieBot, seperti Llama 3.1 8B atau Llama 3.3 70B.";
const FOREIGN_MOVIE_GUIDANCE =
  "Pesan terakhir meminta film luar Indonesia. Tolak dengan sopan dan arahkan ke film Indonesia 2026 dari katalog.";
const OUTSIDE_2026_GUIDANCE =
  "Pesan terakhir meminta film di luar 2026. Tolak dengan sopan dan arahkan ke film Indonesia 2026 dari katalog.";
const CATALOG_TITLE_NOT_FOUND_GUIDANCE =
  "Judul tersebut tidak ada di katalog. Jangan mengarang informasi. Arahkan ke film Indonesia 2026 yang tersedia di katalog.";
const OUT_OF_SCOPE_GUIDANCE =
  "Pesan terakhir di luar scope MovieBot. Tolak dengan sopan dan jangan selesaikan tugas tersebut.";
const NO_YEAR_RECOMMENDATION_GUIDANCE =
  "Rekomendasikan hanya film Indonesia tahun 2026 dari katalog. Jangan menyebut film di luar katalog.";
const SPOILER_LIGHT_GUIDANCE =
  "Jawaban harus spoiler-light. Jangan ungkap ending atau twist.";
const METADATA_INTEGRITY_GUIDANCE =
  "Salin Judul, Genre, Rating, dan Durasi persis dari konteks katalog. Jangan mengubah, menebak, atau menambahkan metadata. Jangan invent duration, genre, rating, atau detail alasan.";
const COMPACT_RECOMMENDATION_GUIDANCE =
  'Untuk rekomendasi normal: tampilkan tepat 3 film terbaik dari konteks. Hanya jika user memakai kata "beberapa", boleh maksimal 4 film. Jangan menampilkan item ke-4 kecuali user meminta beberapa. Gunakan compact bullets, bukan tabel dan bukan numbered list. Format wajib: "- Judul — Genre | Rating | Durasi" lalu baris indent "Alasan: satu kalimat singkat." Jangan pisahkan Rating, Durasi, atau Alasan menjadi paragraf standalone. Jangan awali alasan dengan frasa generik seperti "Film ini"; langsung sebut kecocokannya.';
const UNIQUE_RECOMMENDATION_GUIDANCE =
  "Jangan mengulang judul film yang sama dalam satu jawaban. Pilih 3 judul unik dari konteks katalog.";
const VALID_RECOMMENDATION_GUIDANCE =
  "Permintaan terakhir adalah rekomendasi film yang valid. Jawab langsung tanpa permintaan maaf atau kalimat penolakan.";
const MOOD_LIFTING_GUIDANCE =
  "User sedang mencari film untuk memperbaiki mood. Pilih film ringan, lucu, hangat, atau menghibur. Jangan pilih horor/gelap/menegangkan kecuali diminta.";
const SAD_FILM_GUIDANCE =
  "User meminta film sedih/mengharukan. Pilih film dengan mood sedih, mengharukan, keluarga, atau spiritual.";
const MOVIEBOT_RULE_MODIFICATION_PATTERNS = [
  /\b(?:tambah|tambahkan|masukkan|buat|buatkan)\b.{0,50}\b(?:film|judul|katalog|catalog|knowledge base|basis data)\b/,
  /\b(?:film|judul|katalog|catalog|knowledge base|basis data)\b.{0,50}\b(?:baru|tambah|tambahkan|masukkan|buat|buatkan)\b/,
  /\b(?:hapus|hilangkan|delete|remove)\b.{0,50}\b(?:film|judul|katalog|catalog|knowledge base|basis data)\b/,
  /\b(?:ubah|ganti|edit|update)\b.{0,50}\b(?:tahun rilis|release year|rating|aktor|actor|sutradara|director|film|judul|katalog|catalog|aturan|rule|rules|instruksi|instruction|instructions|system prompt|system instruction)\b/,
  /\b(?:abaikan|lupakan|ignore|forget)\b.{0,50}\b(?:aturan|rule|rules|instruksi|instruction|instructions|system)\b/,
  /\b(?:jawab bebas|bebas jawab|free answer)\b/,
  /\b(?:anggap kamu bukan moviebot|kamu bukan moviebot|jangan jadi moviebot|berhenti jadi moviebot)\b/,
  /\b(?:ubah|ganti|edit|update)\b.{0,50}\bsystem instruction\b/,
  /\bsystem instruction\b.{0,50}\b(?:ubah|ganti|edit|update)\b/,
];
const FOREIGN_MOVIE_PATTERN =
  /\b(?:hollywood|korea|korean|jepang|japanese|anime jepang|anime|marvel|dc|bollywood|india|thailand|thai|barat|luar negeri|asing|foreign)\b/;
const RECOMMENDATION_PATTERN =
  /\b(?:rekomendasi|rekomendasikan|sarankan|saran|pilih|pilihkan|cocok ditonton|film apa|ada film|daftar film)\b/;
const SPOILER_REQUEST_PATTERN =
  /\b(?:spoiler|bocoran|ending|akhir cerita|plot twist)\b/;
const SPECIFIC_MOVIE_QUESTION_PATTERN =
  /\b(?:ceritakan|jelaskan|bahas|sinopsis|spoiler|ending|akhir cerita|plot twist|aktor|pemain|sutradara|rating|durasi|ada film|punya film|tersedia film)\b/;
const GENRE_MOOD_KEYWORDS = [
  "horor",
  "komedi",
  "drama",
  "romansa",
  "thriller",
  "laga",
  "animasi",
  "olahraga",
  "fantasi",
  "ringan",
  "menghibur",
  "hangat",
  "sedih",
  "mengharukan",
  "lucu",
  "keluarga",
  "spiritual",
  "mistis",
  "tegang",
  "inspiratif",
];
const movieCatalog = movieCatalogJson as Movie[];

type GroqChatCompletionResponse = {
  choices?: Array<{
    citations?: unknown;
    finish_reason?: string | null;
    message?: {
      content?: string;
      citations?: unknown;
      executed_tools?: unknown;
      references?: unknown;
      search_results?: unknown;
      sources?: unknown;
    };
    references?: unknown;
    search_results?: unknown;
    sources?: unknown;
  }>;
  citations?: unknown;
  references?: unknown;
  search_results?: unknown;
  sources?: unknown;
  usage?: {
    total_tokens?: number;
  };
};

type SendChatMessageOptions = {
  modelId?: string;
  webSearchEnabled?: boolean;
};

type GroqMessageContent =
  | string
  | Array<
      | {
          type: "text";
          text: string;
        }
      | {
          type: "image_url";
          image_url: {
            url: string;
          };
        }
    >;

type GroqRequestMessage = {
  role: ChatRole;
  content: GroqMessageContent;
};

type GroqRequestBody = {
  model: string;
  messages: GroqRequestMessage[];
  temperature: number;
  max_completion_tokens?: number;
  compound_custom?: {
    tools: {
      enabled_tools: string[];
    };
  };
  tools?: Array<{
    type: "browser_search";
  }>;
  tool_choice?: "required";
};

export type SendChatMessageResult = {
  content: string;
  tokens?: number;
  finishReason?: string | null;
  sources?: ChatSource[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getStringValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function getDomainFromUrl(url?: string) {
  if (!url) {
    return undefined;
  }

  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function toChatSource(value: unknown): ChatSource | null {
  if (typeof value === "string" && value.trim()) {
    const cleanValue = value.trim();

    if (/^https?:\/\//i.test(cleanValue)) {
      return {
        url: cleanValue,
        domain: getDomainFromUrl(cleanValue),
      };
    }

    return {
      title: cleanValue,
    };
  }

  if (!isRecord(value)) {
    return null;
  }

  const url = getStringValue(value, ["url", "link", "href"]);
  const source: ChatSource = {
    title: getStringValue(value, ["title", "name"]),
    url,
    domain:
      getStringValue(value, ["domain", "source", "hostname"]) ??
      getDomainFromUrl(url),
    snippet: getStringValue(value, ["snippet", "description", "text", "content"]),
  };

  if (!source.title && !source.url && !source.domain && !source.snippet) {
    return null;
  }

  return source;
}

function isInternalPlaceholderSource(source: ChatSource) {
  return [source.title, source.domain, source.url, source.snippet].some(
    (value) => {
      const cleanValue = value?.trim().toLowerCase();

      return Boolean(
        cleanValue &&
          INTERNAL_SOURCE_MARKERS.some((marker) => cleanValue.includes(marker)),
      );
    },
  );
}

function hasRealSourceUrl(url?: string) {
  return /^https?:\/\//i.test(url?.trim() ?? "");
}

function hasRealSourceDomain(domain?: string) {
  const cleanDomain = domain?.trim().toLowerCase();

  return Boolean(
    cleanDomain &&
      !cleanDomain.startsWith("browser.") &&
      !INTERNAL_SOURCE_MARKERS.some((marker) => cleanDomain.includes(marker)),
  );
}

function isUsefulSource(source: ChatSource) {
  if (isInternalPlaceholderSource(source)) {
    return false;
  }

  return hasRealSourceUrl(source.url) || hasRealSourceDomain(source.domain);
}

function collectSources(value: unknown, sources: ChatSource[], depth = 0) {
  if (depth > 4) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => {
      collectSources(item, sources, depth + 1);
    });
    return;
  }

  const source = toChatSource(value);

  if (source) {
    sources.push(source);
  }

  if (!isRecord(value)) {
    return;
  }

  [
    "citations",
    "executed_tools",
    "references",
    "results",
    "search_results",
    "sources",
    "web_search_results",
  ].forEach((key) => {
    collectSources(value[key], sources, depth + 1);
  });
}

function extractSources(data: GroqChatCompletionResponse) {
  const sources: ChatSource[] = [];

  collectSources(data.sources, sources);
  collectSources(data.citations, sources);
  collectSources(data.references, sources);
  collectSources(data.search_results, sources);

  data.choices?.forEach((choice) => {
    collectSources(choice.sources, sources);
    collectSources(choice.citations, sources);
    collectSources(choice.references, sources);
    collectSources(choice.search_results, sources);
    collectSources(choice.message?.executed_tools, sources);
    collectSources(choice.message?.sources, sources);
    collectSources(choice.message?.citations, sources);
    collectSources(choice.message?.references, sources);
    collectSources(choice.message?.search_results, sources);
  });

  const seenSources = new Set<string>();

  return sources.filter((source) => {
    const key = source.url ?? source.title ?? source.domain ?? source.snippet;

    if (!key || !isUsefulSource(source) || seenSources.has(key)) {
      return false;
    }

    seenSources.add(key);
    return true;
  });
}

function isValidImageDataUrl(dataUrl: string) {
  return /^data:image\/(?:png|jpeg|webp);base64,/i.test(dataUrl);
}

function messageHasValidImage(message: ChatMessage) {
  return Boolean(message.image && isValidImageDataUrl(message.image.dataUrl));
}

function responseIndicatesUnsupportedVision(errorBody: string) {
  const cleanBody = errorBody.toLowerCase();
  const mentionsImageInput =
    cleanBody.includes("image") ||
    cleanBody.includes("image_url") ||
    cleanBody.includes("vision") ||
    cleanBody.includes("multimodal");
  const mentionsUnsupportedCapability =
    cleanBody.includes("unsupported") ||
    cleanBody.includes("does not support") ||
    cleanBody.includes("not support") ||
    cleanBody.includes("cannot process") ||
    cleanBody.includes("can't process") ||
    cleanBody.includes("capability");

  return mentionsImageInput && mentionsUnsupportedCapability;
}

async function getResponseErrorBody(response: Response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function isCompoundWebSearchModel(modelId: string) {
  return (
    modelId === GROQ_MODEL_IDS.groqCompound ||
    modelId === GROQ_MODEL_IDS.groqCompoundMini
  );
}

function isGptOssBrowserSearchModel(modelId: string) {
  return modelId === GROQ_MODEL_IDS.gptOss120b;
}

function trimMessageContent(content: string, maxLength: number) {
  const cleanContent = content.replace(/\s+/g, " ").trim();

  if (cleanContent.length <= maxLength) {
    return cleanContent;
  }

  return `${cleanContent.slice(0, maxLength).trim()}...`;
}

function toWebSearchContextMessage(
  message: ChatMessage,
  isLatestUserMessage: boolean,
): ChatMessage {
  const maxLength =
    message.role === "assistant"
      ? WEB_SEARCH_ASSISTANT_CONTEXT_LENGTH
      : WEB_SEARCH_USER_CONTEXT_LENGTH;
  const content = isLatestUserMessage
    ? message.content.trim()
    : trimMessageContent(message.content, maxLength);

  return {
    role: message.role,
    content,
  };
}

function getWebSearchMessages(messages: ChatMessage[]) {
  const latestUserOffset = [...messages]
    .reverse()
    .findIndex((message) => message.role === "user");

  if (latestUserOffset === -1) {
    return messages
      .slice(-WEB_SEARCH_CONTEXT_LIMIT)
      .map((message) => toWebSearchContextMessage(message, false));
  }

  const latestUserIndex = messages.length - 1 - latestUserOffset;
  const contextStart = Math.max(0, latestUserIndex - WEB_SEARCH_CONTEXT_LIMIT);

  return messages
    .slice(contextStart, latestUserIndex + 1)
    .filter((message) => message.content.trim().length > 0)
    .map((message, index, contextMessages) =>
      toWebSearchContextMessage(
        message,
        index === contextMessages.length - 1 && message.role === "user",
      ),
    );
}

function getLatestUserMessageOnly(messages: ChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message.role === "user" && message.content.trim()) {
      return [toWebSearchContextMessage(message, true)];
    }
  }

  return getWebSearchMessages(messages).slice(-1);
}

function getNormalChatMessages(messages: ChatMessage[]) {
  return messages.slice(-NORMAL_CHAT_CONTEXT_LIMIT);
}

function normalizeSearchText(content: string) {
  return content
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMovieBotUserMessage(content: string) {
  return normalizeSearchText(content);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function includesNormalizedPhrase(content: string, phrase: string) {
  return new RegExp(`(?:^|\\s)${escapeRegExp(phrase)}(?:\\s|$)`).test(
    content,
  );
}

const catalogTitleIndex = movieCatalog.map((movie) => ({
  title: movie.title,
  cleanTitle: normalizeSearchText(movie.title),
}));

function messageMentionsCatalogTitle(cleanContent: string) {
  return catalogTitleIndex.some(({ cleanTitle }) =>
    includesNormalizedPhrase(cleanContent, cleanTitle),
  );
}

function toGroqRequestMessage(
  message: ChatMessage,
  modelSupportsVision: boolean,
  includeImage: boolean,
): GroqRequestMessage {
  if (
    includeImage &&
    message.role === "user" &&
    message.image &&
    modelSupportsVision &&
    isValidImageDataUrl(message.image.dataUrl)
  ) {
    return {
      role: message.role,
      content: [
        {
          type: "text",
          text: message.content,
        },
        {
          type: "image_url",
          image_url: {
            url: message.image.dataUrl,
          },
        },
      ],
    };
  }

  return {
    role: message.role,
    content: message.content,
  };
}

function getSystemInstructionMessage(): GroqRequestMessage {
  return {
    role: "system",
    content: chatbotConfig.systemInstruction,
  };
}

function isAbortError(error: unknown) {
  return isRecord(error) && error.name === "AbortError";
}

function isMovieBotMode() {
  return chatbotConfig.botName === "MovieBot";
}

function getContentWithoutCatalogTitles(cleanContent: string) {
  return catalogTitleIndex.reduce((content, { cleanTitle }) => {
    if (!includesNormalizedPhrase(content, cleanTitle)) {
      return content;
    }

    return content
      .replace(
        new RegExp(`(?:^|\\s)${escapeRegExp(cleanTitle)}(?:\\s|$)`, "g"),
        " ",
      )
      .replace(/\s+/g, " ")
      .trim();
  }, cleanContent);
}

function isForeignMoviePrompt(cleanContent: string) {
  return FOREIGN_MOVIE_PATTERN.test(cleanContent);
}

function isOutside2026Prompt(cleanContent: string) {
  const contentWithoutCatalogTitles = getContentWithoutCatalogTitles(cleanContent);
  const years = contentWithoutCatalogTitles.match(/\b(?:19|20)\d{2}\b/g) ?? [];

  return years.some((year) => year !== "2026");
}

function isRecommendationPrompt(cleanContent: string) {
  return RECOMMENDATION_PATTERN.test(cleanContent);
}

function hasAnyRequestYearReference(cleanContent: string) {
  return /\b(?:19|20)\d{2}\b/.test(getContentWithoutCatalogTitles(cleanContent));
}

function isSpoilerExplicitlyRequested(cleanContent: string) {
  return SPOILER_REQUEST_PATTERN.test(cleanContent);
}

function getRequestedGenreMoodTerms(cleanContent: string) {
  return GENRE_MOOD_KEYWORDS.filter((keyword) =>
    includesNormalizedPhrase(cleanContent, keyword),
  );
}

function hasGenericGenreMoodRequest(cleanContent: string) {
  return (
    getRequestedGenreMoodTerms(cleanContent).length > 0 ||
    /\b(?:genre|mood|indonesia|2026|katalog|daftar|rekomendasi|rekomendasikan)\b/.test(
      cleanContent,
    )
  );
}

function isCatalogTitleNotFoundPrompt(cleanContent: string) {
  if (isActorLookupIntent(cleanContent)) {
    return false;
  }

  if (messageMentionsCatalogTitle(cleanContent)) {
    return false;
  }

  if (!SPECIFIC_MOVIE_QUESTION_PATTERN.test(cleanContent)) {
    return false;
  }

  return !hasGenericGenreMoodRequest(cleanContent);
}

function getGenreMoodGuidance(cleanContent: string) {
  const requestedTerms = getRequestedGenreMoodTerms(cleanContent);

  if (requestedTerms.length === 0) {
    return null;
  }

  return `Preferensi genre/mood terdeteksi: ${requestedTerms.join(", ")}. Gunakan hanya konteks katalog relevan yang diberikan.`;
}

function getMoodRecommendationGuidance(userMessage: string) {
  if (isMoodLiftingMoviePrompt(userMessage)) {
    return MOOD_LIFTING_GUIDANCE;
  }

  if (isSadFilmMoviePrompt(userMessage)) {
    return SAD_FILM_GUIDANCE;
  }

  return null;
}

function getLatestUserMessageContent(messages: ChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message.role === "user" && message.content.trim()) {
      return message.content;
    }
  }

  return "";
}

function getLatestAssistantMessageContent(messages: ChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message.role === "assistant" && message.content.trim()) {
      return message.content;
    }
  }

  return "";
}

function getMovieBotDynamicGuidanceMessage(userMessage: string) {
  if (!isMovieBotMode()) {
    return null;
  }

  const cleanContent = normalizeMovieBotUserMessage(userMessage);

  if (!cleanContent) {
    return null;
  }

  const guidanceMessages: string[] = [];

  if (isOutOfScopeMovieBotIntent(userMessage)) {
    guidanceMessages.push(OUT_OF_SCOPE_GUIDANCE);
  }

  if (isForeignMoviePrompt(cleanContent)) {
    guidanceMessages.push(FOREIGN_MOVIE_GUIDANCE);
  }

  if (isOutside2026Prompt(cleanContent)) {
    guidanceMessages.push(OUTSIDE_2026_GUIDANCE);
  }

  if (isCatalogTitleNotFoundPrompt(cleanContent)) {
    guidanceMessages.push(CATALOG_TITLE_NOT_FOUND_GUIDANCE);
  }

  if (
    isRecommendationPrompt(cleanContent) &&
    !isOutOfScopeMovieBotIntent(userMessage) &&
    !isForeignMoviePrompt(cleanContent) &&
    !isOutside2026Prompt(cleanContent)
  ) {
    guidanceMessages.push(VALID_RECOMMENDATION_GUIDANCE);
  }

  if (isRecommendationPrompt(cleanContent) && !hasAnyRequestYearReference(cleanContent)) {
    guidanceMessages.push(NO_YEAR_RECOMMENDATION_GUIDANCE);
  }

  if (!isSpoilerExplicitlyRequested(cleanContent)) {
    guidanceMessages.push(SPOILER_LIGHT_GUIDANCE);
  }

  const genreMoodGuidance = getGenreMoodGuidance(cleanContent);

  if (genreMoodGuidance) {
    guidanceMessages.push(genreMoodGuidance);
  }

  const moodRecommendationGuidance = getMoodRecommendationGuidance(userMessage);

  if (moodRecommendationGuidance) {
    guidanceMessages.push(moodRecommendationGuidance);
  }

  if (genreMoodGuidance || isRecommendationPrompt(cleanContent)) {
    guidanceMessages.push(METADATA_INTEGRITY_GUIDANCE);
    guidanceMessages.push(COMPACT_RECOMMENDATION_GUIDANCE);
    guidanceMessages.push(UNIQUE_RECOMMENDATION_GUIDANCE);
  }

  return guidanceMessages.length > 0 ? guidanceMessages.join("\n\n") : null;
}

function isMovieBotRuleModificationAttempt(content: string) {
  const cleanContent = normalizeMovieBotUserMessage(content);

  if (!cleanContent) {
    return false;
  }

  return MOVIEBOT_RULE_MODIFICATION_PATTERNS.some((pattern) =>
    pattern.test(cleanContent),
  );
}

function getMovieBotLocalFallback(messages: ChatMessage[]) {
  if (!isMovieBotMode()) {
    return null;
  }

  const latestUserMessage = getLatestUserMessageContent(messages);
  const cleanContent = normalizeMovieBotUserMessage(latestUserMessage);

  if (!isMovieBotRuleModificationAttempt(latestUserMessage)) {
    if (isOutOfScopeMovieBotIntent(latestUserMessage)) {
      return {
        content: MOVIEBOT_OUT_OF_SCOPE_FALLBACK_MESSAGE,
      };
    }

    if (isCatalogCountIntent(latestUserMessage)) {
      return {
        content: `Ada ${getMovieCatalogCount()} film Indonesia tahun 2026 di katalog MovieBot.`,
      };
    }

    if (isGenreSummaryIntent(latestUserMessage)) {
      return {
        content: getGenreSummaryMessage(),
      };
    }

    if (isTitleCastIntent(latestUserMessage)) {
      const titleLookup = findMovieTitleLookupResult(latestUserMessage);

      return {
        content: getTitleCastLookupMessage(titleLookup),
      };
    }

    const actorLookup = findMoviesByActorQuery(latestUserMessage);

    if (actorLookup) {
      return {
        content: getActorLookupMessage(actorLookup),
      };
    }

    if (isLongRecommendationRequest(cleanContent)) {
      return {
        content: getLongRecommendationRedirectMessage(latestUserMessage),
      };
    }

    if (isCatalogListIntent(latestUserMessage)) {
      return {
        content: getCatalogListPageMessage(0),
      };
    }

    if (isFilteredCatalogBrowseIntent(latestUserMessage)) {
      return {
        content: getFilteredCatalogBrowseMessage(latestUserMessage),
      };
    }

    if (isCatalogPaginationIntent(latestUserMessage)) {
      return {
        content: getNextCatalogListPageMessage(messages),
      };
    }

    return null;
  }

  return {
    content: MOVIEBOT_RULE_MODIFICATION_FALLBACK_MESSAGE,
  };
}

function isLongRecommendationRequest(cleanContent: string) {
  return (
    isRecommendationPrompt(cleanContent) &&
    /\b(?:semua|seluruh|lengkap|beserta alasannya|dengan alasannya)\b/.test(
      cleanContent,
    )
  );
}

function sanitizeMarkdownTableCell(value: string | number) {
  return String(value).replace(/\s+/g, " ").replace(/\|/g, "/").trim();
}

function getMovieListTableRows(movies: Movie[], startIndex = 0) {
  const rows = movies.map((movie, index) => {
    const rowNumber = startIndex + index + 1;
    const genres = movie.genres.join(", ");

    return [
      rowNumber,
      movie.title,
      genres,
      movie.rating,
      `${movie.durationMinutes}m`,
    ]
      .map(sanitizeMarkdownTableCell)
      .join(" | ");
  });

  return [
    "| No | Judul | Genre | Rating | Durasi |",
    "|---:|---|---|---|---:|",
    ...rows.map((row) => `| ${row} |`),
  ].join("\n");
}

function getActorMovieTableRows(movies: Movie[]) {
  const rows = movies.map((movie) =>
    [
      movie.title,
      movie.genres.join(", "),
      movie.rating,
      `${movie.durationMinutes}m`,
    ]
      .map(sanitizeMarkdownTableCell)
      .join(" | "),
  );

  return [
    "| Judul | Genre | Rating | Durasi |",
    "|---|---|---|---:|",
    ...rows.map((row) => `| ${row} |`),
  ].join("\n");
}

function getCastTableRows(movie: Movie) {
  return [
    "| No | Aktor |",
    "|---:|---|",
    ...movie.actors.map(
      (actorName, index) =>
        `| ${index + 1} | ${sanitizeMarkdownTableCell(actorName)} |`,
    ),
  ].join("\n");
}

function getTitleOptionsTableRows(movies: Movie[]) {
  const rows = movies.map((movie, index) =>
    [
      index + 1,
      movie.title,
      movie.genres.join(", "),
    ]
      .map(sanitizeMarkdownTableCell)
      .join(" | "),
  );

  return [
    "| No | Judul | Genre |",
    "|---:|---|---|",
    ...rows.map((row) => `| ${row} |`),
  ].join("\n");
}

function getTitleCastLookupMessage(titleLookup: TitleLookupResult) {
  const { movie, alternatives } = titleLookup;

  if (!movie) {
    if (alternatives.length > 1) {
      return [
        "Saya menemukan beberapa judul yang mirip. Maksud Anda yang mana?",
        "",
        getTitleOptionsTableRows(alternatives),
      ].join("\n");
    }

    return MOVIEBOT_TITLE_NOT_FOUND_FALLBACK_MESSAGE;
  }

  return [
    `${movie.title} dibintangi oleh:`,
    "",
    getCastTableRows(movie),
  ].join("\n");
}

function getActorLookupMessage(actorLookup: ActorLookupResult) {
  if (actorLookup.matches.length === 0) {
    return MOVIEBOT_ACTOR_NOT_FOUND_FALLBACK_MESSAGE;
  }

  if (actorLookup.matches.length === 1) {
    const [match] = actorLookup.matches;

    return [
      `Ditemukan film dengan aktor ${match.actorName} di katalog MovieBot:`,
      "",
      getActorMovieTableRows(match.movies),
    ].join("\n");
  }

  const actorNames = actorLookup.matches
    .map((match) => match.actorName)
    .join(", ");
  const searchTerm = actorLookup.searchTerms.join(", ");

  return `Saya menemukan beberapa aktor yang mirip dengan "${searchTerm}": ${actorNames}. Maksud Anda yang mana?`;
}

function getCatalogListPageMessage(pageIndex: number) {
  const page = getCatalogMoviesPage(pageIndex);
  const displayedCount = page.movies.length;
  const pageRange =
    displayedCount > 0 ? ` (${page.startIndex + 1}–${page.endIndex})` : "";
  const movieTable = getMovieListTableRows(page.movies, page.startIndex);
  const nextPrompt =
    page.endIndex < page.totalCount
      ? "\n\nKetik 'lanjut' untuk melihat 10 film berikutnya."
      : "\n\nSemua film di katalog sudah ditampilkan.";

  return [
    `Menampilkan ${displayedCount} dari ${page.totalCount} film Indonesia 2026 di katalog MovieBot${pageRange}:`,
    "",
    movieTable,
  ].join("\n") + nextPrompt;
}

function getNextCatalogListPageMessage(messages: ChatMessage[]) {
  const latestAssistantMessage = getLatestAssistantMessageContent(messages);
  const rangeMatch = latestAssistantMessage.match(
    /Menampilkan\s+\d+\s+dari\s+\d+\s+film[\s\S]*?\((\d+)[-–](\d+)\)/i,
  );

  if (!rangeMatch) {
    return getCatalogListPageMessage(0);
  }

  const endIndex = Number(rangeMatch[2]);

  if (!Number.isFinite(endIndex)) {
    return getCatalogListPageMessage(0);
  }

  return getCatalogListPageMessage(Math.floor(endIndex / 10));
}

function getFilteredCatalogBrowseMessage(userMessage: string) {
  const movies = getFilteredCatalogBrowseMovies(userMessage);
  const label = getFilteredCatalogBrowseLabel(userMessage);
  const visibleMovies = movies.slice(0, 10);
  const movieTable = getMovieListTableRows(visibleMovies);
  const suffix =
    movies.length > visibleMovies.length
      ? "\n\nMinta rekomendasi jika ingin 3 pilihan terbaik dari filter ini."
      : "";

  return [
    `Menampilkan ${visibleMovies.length} dari ${movies.length} film Indonesia 2026 untuk filter "${label}":`,
    "",
    movieTable,
  ].join("\n") + suffix;
}

function getLongRecommendationRedirectMessage(userMessage: string) {
  const filteredMovies = getFilteredCatalogBrowseMovies(userMessage);

  if (filteredMovies.length > 0) {
    return [
      "Agar jawabannya tetap ringkas, saya tidak menampilkan semua film beserta alasan panjang.",
      getFilteredCatalogBrowseMessage(userMessage),
    ].join("\n\n");
  }

  return [
    "Agar jawabannya tetap ringkas, saya tidak menampilkan semua film beserta alasan panjang.",
    getCatalogListPageMessage(0),
  ].join("\n\n");
}

function shouldSkipCatalogContext(latestUserMessage: string, cleanContent: string) {
  return (
    isGreetingOrIdentityPrompt(latestUserMessage) ||
    isForeignMoviePrompt(cleanContent) ||
    isOutside2026Prompt(cleanContent)
  );
}

function shouldAddNoRelevantCatalogGuidance(
  latestUserMessage: string,
  cleanContent: string,
) {
  return (
    isCatalogTitleNotFoundPrompt(cleanContent) ||
    asksForMovieRecommendation(latestUserMessage) ||
    SPECIFIC_MOVIE_QUESTION_PATTERN.test(cleanContent)
  );
}

function getMovieBotCatalogContextMessage(latestUserMessage: string) {
  if (!isMovieBotMode()) {
    return {
      message: null,
      relevantMovieCount: 0,
      compactCatalogChars: 0,
    };
  }

  const cleanContent = normalizeMovieBotUserMessage(latestUserMessage);

  if (!cleanContent || shouldSkipCatalogContext(latestUserMessage, cleanContent)) {
    return {
      message: null,
      relevantMovieCount: 0,
      compactCatalogChars: 0,
    };
  }

  const relevantMovies = getRelevantMovies(latestUserMessage);

  if (relevantMovies.length === 0) {
    const guidanceMessage = shouldAddNoRelevantCatalogGuidance(
      latestUserMessage,
      cleanContent,
    )
      ? "Tidak ada data katalog relevan untuk permintaan ini. Jangan mengarang film; arahkan ke film Indonesia 2026 yang tersedia."
      : null;

    return {
      message: guidanceMessage
        ? {
            role: "system" as const,
            content: guidanceMessage,
          }
        : null,
      relevantMovieCount: 0,
      compactCatalogChars: guidanceMessage?.length ?? 0,
    };
  }

  const compactMovieContext = buildCompactMovieContext(
    relevantMovies,
    asksForSynopsis(latestUserMessage),
  );

  return {
    message: {
      role: "system" as const,
      content: `Katalog film relevan dari JSON lokal:\n${compactMovieContext}`,
    },
    relevantMovieCount: relevantMovies.length,
    compactCatalogChars: compactMovieContext.length,
  };
}

function logGroqBadRequestDetails(
  modelId: string,
  webSearchEnabled: boolean,
  errorBody: string,
) {
  console.error("Groq API request failed with status 400", {
    modelId,
    webSearchEnabled,
    errorBody,
  });
}

function logGroqRequestTooLargeDetails({
  requestBodySize,
  messageCount,
  modelId,
  relevantMovieCount,
  compactCatalogChars,
}: {
  requestBodySize: number;
  messageCount: number;
  modelId: string;
  relevantMovieCount: number;
  compactCatalogChars: number;
}) {
  console.error("Groq API request failed with status 413", {
    requestBodySize,
    messageCount,
    modelId,
    relevantMovieCount,
    compactCatalogChars,
  });
}

function getGroqMessageContentStats(content: GroqMessageContent) {
  if (typeof content === "string") {
    return {
      contentCharacters: content.length,
      imageCharacters: 0,
      imageCount: 0,
    };
  }

  return content.reduce(
    (stats, item) => {
      if (item.type === "text") {
        stats.contentCharacters += item.text.length;
      } else {
        stats.imageCharacters += item.image_url.url.length;
        stats.imageCount += 1;
      }

      return stats;
    },
    {
      contentCharacters: 0,
      imageCharacters: 0,
      imageCount: 0,
    },
  );
}

function logGroqRequestStats(
  requestBodyText: string,
  requestMessages: GroqRequestMessage[],
) {
  if (!import.meta.env.DEV) {
    return;
  }

  const stats = requestMessages.reduce(
    (totals, message) => {
      const messageStats = getGroqMessageContentStats(message.content);

      totals.contentCharacters += messageStats.contentCharacters;
      totals.imageCharacters += messageStats.imageCharacters;
      totals.imageCount += messageStats.imageCount;

      return totals;
    },
    {
      contentCharacters: 0,
      imageCharacters: 0,
      imageCount: 0,
    },
  );

  console.info("Groq request size", {
    messageCount: requestMessages.length,
    totalCharacters: requestBodyText.length,
    estimatedTokens: Math.ceil(requestBodyText.length / ESTIMATED_CHARS_PER_TOKEN),
    contentCharacters: stats.contentCharacters,
    imageCharacters: stats.imageCharacters,
    imageCount: stats.imageCount,
  });
}

function dedupeRepeatedMovieBullets(content: string) {
  const seenTitles = new Set<string>();
  const lines = content.split("\n");
  const cleanLines: string[] = [];
  let skippingDuplicateBullet = false;

  lines.forEach((line) => {
    const bulletMatch = line.match(/^\s*-\s+(.+?)\s+—/);

    if (bulletMatch) {
      const cleanTitle = normalizeSearchText(bulletMatch[1]);

      if (cleanTitle && seenTitles.has(cleanTitle)) {
        skippingDuplicateBullet = true;
        return;
      }

      seenTitles.add(cleanTitle);
      skippingDuplicateBullet = false;
      cleanLines.push(line);
      return;
    }

    if (
      skippingDuplicateBullet &&
      (!line.trim() || /^\s+(?:Alasan:|\S)/.test(line))
    ) {
      return;
    }

    skippingDuplicateBullet = false;
    cleanLines.push(line);
  });

  return cleanLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function cleanMovieBotRecommendationOutput(content: string) {
  if (!isMovieBotMode()) {
    return content;
  }

  const cleanContent = content.replace(
    /^(\s*Alasan:\s*)Film ini\s+([a-z])/gim,
    (_, prefix: string, firstLetter: string) =>
      `${prefix}${firstLetter.toUpperCase()}`,
  );

  return dedupeRepeatedMovieBullets(cleanContent);
}

export async function sendChatMessage(
  messages: ChatMessage[],
  options: SendChatMessageOptions = {},
): Promise<SendChatMessageResult> {
  const localFallback = getMovieBotLocalFallback(messages);

  if (localFallback) {
    return localFallback;
  }

  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  const modelId = options.modelId ?? GROQ_MODEL;
  const modelSupportsVision = supportsVision(modelId);
  const useWebSearchTools =
    options.webSearchEnabled === true &&
    supportsWebSearch(modelId) &&
    !isMovieBotMode();
  const useCompoundWebSearch = useWebSearchTools && isCompoundWebSearchModel(modelId);
  const latestUserMessage = getLatestUserMessageContent(messages);
  const rawRequestMessages = useCompoundWebSearch
    ? getLatestUserMessageOnly(messages)
    : useWebSearchTools
      ? getWebSearchMessages(messages)
      : getNormalChatMessages(messages);
  const requestMessages = rawRequestMessages;
  const requestSendsImage =
    modelSupportsVision &&
    requestMessages.some(
      (message, index) =>
        index === requestMessages.length - 1 && messageHasValidImage(message),
    );
  const catalogContext = getMovieBotCatalogContextMessage(latestUserMessage);
  const dynamicGuidanceContent = getMovieBotDynamicGuidanceMessage(latestUserMessage);
  const dynamicGuidanceMessage: GroqRequestMessage | null = dynamicGuidanceContent
    ? {
        role: "system",
        content: dynamicGuidanceContent,
      }
    : null;

  if (!apiKey) {
    throw new Error("Groq API key is missing. Add VITE_GROQ_API_KEY to your .env file.");
  }

  const requestBody: GroqRequestBody = {
    model: modelId,
    messages: [
      getSystemInstructionMessage(),
      ...(catalogContext.message ? [catalogContext.message] : []),
      ...(dynamicGuidanceMessage ? [dynamicGuidanceMessage] : []),
      ...requestMessages.map((message, index) =>
        toGroqRequestMessage(
          message,
          modelSupportsVision,
          index === requestMessages.length - 1,
        ),
      ),
    ],
    temperature: 0.2,
    max_completion_tokens: DEFAULT_MAX_COMPLETION_TOKENS,
  };

  if (useCompoundWebSearch) {
    requestBody.max_completion_tokens = COMPOUND_MAX_COMPLETION_TOKENS;
    requestBody.compound_custom = {
      tools: {
        enabled_tools: ["web_search"],
      },
    };
  }

  if (useWebSearchTools && isGptOssBrowserSearchModel(modelId)) {
    requestBody.tools = [{ type: "browser_search" }];
    requestBody.tool_choice = "required";
  }

  const requestBodyText = JSON.stringify(requestBody);
  const requestBodySize = requestBodyText.length;
  logGroqRequestStats(requestBodyText, requestBody.messages);
  const abortController = new AbortController();
  const timeoutId = globalThis.setTimeout(() => {
    abortController.abort();
  }, GROQ_REQUEST_TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: requestBodyText,
      signal: abortController.signal,
    });
  } catch (fetchError) {
    if (isAbortError(fetchError)) {
      throw new Error(
        "Groq API request timed out. Please check your connection and try again.",
        { cause: fetchError },
      );
    }

    throw fetchError;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorBody = await getResponseErrorBody(response);

    if (
      requestSendsImage &&
      responseIndicatesUnsupportedVision(errorBody)
    ) {
      throw new Error(
        "This model cannot process the selected image. Please switch to Llama 4 Scout.",
      );
    }

    if (response.status === 413) {
      logGroqRequestTooLargeDetails({
        requestBodySize,
        messageCount: requestBody.messages.length,
        modelId,
        relevantMovieCount: catalogContext.relevantMovieCount,
        compactCatalogChars: catalogContext.compactCatalogChars,
      });

      throw new Error(
        "Request terlalu besar. Coba pertanyaan yang lebih spesifik, misalnya genre atau mood film.",
      );
    }

    if (response.status === 429) {
      throw new Error(
        "Batas request Groq sementara tercapai. Tunggu beberapa saat, lalu coba lagi atau pilih model lain.",
      );
    }

    if (response.status === 400) {
      logGroqBadRequestDetails(
        modelId,
        options.webSearchEnabled === true,
        errorBody,
      );

      if (isMovieBotMode() && options.webSearchEnabled === true) {
        throw new Error(MOVIEBOT_WEB_SEARCH_UNNEEDED_MESSAGE);
      }

      throw new Error(UNSUPPORTED_REQUEST_CONFIGURATION_MESSAGE);
    }

    throw new Error(
      `Groq API request failed with status ${response.status}. Please check the selected model, file format, or request size.`,
    );
  }

  const data = (await response.json()) as GroqChatCompletionResponse;
  const firstChoice = data.choices?.[0];
  const content = firstChoice?.message?.content;
  const finishReason = firstChoice?.finish_reason ?? null;
  const sources = extractSources(data);

  if (!content) {
    throw new Error("Groq API response did not include assistant content.");
  }

  if (import.meta.env.DEV) {
    console.info("Groq response diagnostics", {
      finishReason,
      totalTokens: data.usage?.total_tokens,
      contentCharacters: content.length,
    });
  }

  const cleanContent = cleanMovieBotRecommendationOutput(content);
  const finalContent =
    finishReason === "length"
      ? `${cleanContent.trim()}\n\nJawaban dipersingkat agar tidak terlalu panjang. Minta 'lanjut' jika ingin rekomendasi tambahan.`
      : cleanContent;

  const result: SendChatMessageResult = {
    content: finalContent,
  };

  if (finishReason !== null) {
    result.finishReason = finishReason;
  }

  if (typeof data.usage?.total_tokens === "number") {
    result.tokens = data.usage.total_tokens;
  }

  if (sources.length > 0) {
    result.sources = sources;
  }

  return result;
}
