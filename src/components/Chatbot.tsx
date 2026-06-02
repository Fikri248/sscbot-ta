import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, KeyboardEvent, ReactNode } from "react";
import DeleteChatModal from "./DeleteChatModal";
import DynamicIslandToast from "./DynamicIslandToast";
import HistoryChat from "./HistoryChat";
import Library from "./Library";
import chatbotConfig from "../config/chatbotConfig";
import {
  CHAT_MODEL_OPTIONS,
  GROQ_MODEL_IDS,
  getGroqModelName,
  isSelectableChatModel,
  type ChatModelOption,
} from "../config/groqModels";
import {
  supportsVision,
  supportsWebSearch,
} from "../config/modelCapabilities";
import {
  deleteChatSession,
  generateChatId,
  getChatIdFromUrl,
  GROQ_MODEL_NAME,
  loadChatSession,
  resetChatUrl,
  saveChatSession,
  setChatUrl,
  type SavedChatSession,
} from "../services/chatStorage";
import { sendChatMessage } from "../services/groqService";
import type {
  ChatImageAttachment,
  ChatMessage,
  ChatSource,
} from "../types/chat";

type SuggestedPrompt = {
  title: string;
  description: string;
  prompt: string;
};

type AttachmentMenuItem = {
  action: "image" | "file" | "web";
  icon: string;
  title: string;
  subtitle: string;
};

type AttachmentMenuItemState = {
  disabled: boolean;
  title?: string;
  active: boolean;
  subtitle?: string;
};

type MarkdownBlock =
  | {
      type: "heading";
      level: 1 | 2 | 3;
      text: string;
    }
  | {
      type: "paragraph";
      lines: string[];
    }
  | {
      type: "unordered-list";
      items: string[];
    }
  | {
      type: "ordered-list";
      items: string[];
      start: number;
    }
  | {
      type: "table";
      headers: string[];
      rows: string[][];
    };

type MarkdownTableBlock = Extract<MarkdownBlock, { type: "table" }>;

type SelectedAttachment = {
  name: string;
  type: "image" | "file";
  mimeType?: ChatImageAttachment["mimeType"];
  dataUrl?: string;
};

type ChatSessionSnapshotInput = {
  chatTitle: string;
  hasCustomTitle: boolean;
  messages: ChatMessage[];
  model?: string;
};

type ChatbotProps = {
  onLogout?: () => void;
};

const imageMimeTypes: ChatImageAttachment["mimeType"][] = [
  "image/png",
  "image/jpeg",
  "image/webp",
];
const internalSourceMarkers = [
  "browser.search",
  "browser.open",
  "browser.find",
  "browser.click",
  "browser.run",
];
const compoundWebSearchUnavailableMessage =
  "Compound web search is currently unavailable in this browser demo. Use GPT OSS 120B.";
const fileUploadUnsupportedMessage =
  "File upload is not supported by the current models";
const isMovieBotMode = chatbotConfig.botName === "MovieBot";
const movieBotWebSearchWarningMessage =
  "MovieBot memakai katalog lokal film Indonesia 2026.";

const suggestedPrompts: SuggestedPrompt[] = [
  {
    title: "Cetak Transkrip",
    description: "Cara cetak nilai",
    prompt: "Bagaimana cara mencetak transkrip nilai akademik?",
  },
  {
    title: "Pembayaran BPP",
    description: "Jadwal dan tata cara",
    prompt: "Kapan batas akhir pembayaran BPP semester ini dan bagaimana caranya?",
  },
  {
    title: "Sidang Skripsi",
    description: "Syarat pendaftaran",
    prompt: "Apa saja persyaratan untuk mendaftar sidang skripsi?",
  },
  {
    title: "Cuti Akademik",
    description: "Prosedur pengajuan",
    prompt: "Bagaimana prosedur pengajuan cuti akademik?",
  },
  {
    title: "Kartu Mahasiswa",
    description: "KTM Hilang",
    prompt: "Apa yang harus dilakukan jika KTM saya hilang?",
  },
  {
    title: "Jadwal Kuliah",
    description: "Perubahan jadwal",
    prompt: "Bagaimana cara melihat atau mengajukan perubahan jadwal kuliah?",
  },
  {
    title: "Sertifikat TAK",
    description: "Input kegiatan",
    prompt: "Bagaimana cara menginput sertifikat TAK ke sistem?",
  },
  {
    title: "Beasiswa",
    description: "Informasi beasiswa",
    prompt: "Apakah ada informasi pendaftaran beasiswa terbaru?",
  },
];

const attachmentMenuItems: AttachmentMenuItem[] = [
  {
    action: "image",
    icon: "image",
    title: "Add Image",
    subtitle: "JPG, PNG, WEBP",
  },
  {
    action: "file",
    icon: "description",
    title: "Add File",
    subtitle: "PDF, DOCX, TXT",
  },
  {
    action: "web",
    icon: "language",
    title: "Web Search",
    subtitle: "Find info from internet",
  },
];

const chatModelOptions = CHAT_MODEL_OPTIONS;

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return `Something went wrong while contacting ${chatbotConfig.botName}.`;
}

function isToday(date: Date) {
  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function formatClockTime(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateMonth(date: Date) {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

function formatMessageTime(date: Date) {
  if (isToday(date)) {
    return formatClockTime(date);
  }

  return `${formatDateMonth(date)}, ${formatClockTime(date)}`;
}

function formatDividerTime(date: Date) {
  if (isToday(date)) {
    return `Today, ${formatClockTime(date)}`;
  }

  return `${formatDateMonth(date)}, ${formatClockTime(date)}`;
}

function getMessageDate(message?: ChatMessage) {
  if (!message?.createdAt) {
    return new Date();
  }

  const date = new Date(message.createdAt);

  if (Number.isNaN(date.getTime())) {
    return new Date();
  }

  return date;
}

function createChatTitle(message: string) {
  const cleanMessage = message.replace(/\s+/g, " ").trim();
  const maxLength = 90;

  if (cleanMessage.length <= maxLength) {
    return cleanMessage || "New Chat";
  }

  return cleanMessage.slice(0, maxLength).trim();
}

function createAssistantMessage(
  content: string,
  modelId: string,
  modelName: string,
  tokens?: number,
  sources?: ChatSource[],
): ChatMessage {
  const assistantMessage: ChatMessage = {
    role: "assistant",
    content,
    createdAt: new Date().toISOString(),
    modelId,
    modelName,
  };

  if (typeof tokens === "number") {
    assistantMessage.tokens = tokens;
  }

  if (sources && sources.length > 0) {
    assistantMessage.sources = sources;
  }

  return assistantMessage;
}

function getLatestAssistantMessageIndex(messages: ChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "assistant") {
      return index;
    }
  }

  return -1;
}

function getSourceDomain(source: ChatSource) {
  if (source.domain) {
    return source.domain;
  }

  if (!source.url) {
    return undefined;
  }

  try {
    return new URL(source.url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function getSourceTitle(source: ChatSource, index: number) {
  return source.title || getSourceDomain(source) || `Source ${index + 1}`;
}

function sourceContainsInternalMarker(source: ChatSource) {
  return [source.title, source.domain, source.url, source.snippet].some(
    (value) => {
      const cleanValue = value?.trim().toLowerCase();

      return Boolean(
        cleanValue &&
          internalSourceMarkers.some((marker) => cleanValue.includes(marker)),
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
      !internalSourceMarkers.some((marker) => cleanDomain.includes(marker)),
  );
}

function isDisplayableSource(source: ChatSource) {
  if (sourceContainsInternalMarker(source)) {
    return false;
  }

  return hasRealSourceUrl(source.url) || hasRealSourceDomain(getSourceDomain(source));
}

function getDisplayableSources(sources: ChatSource[]) {
  return sources.filter(isDisplayableSource);
}

function getSelectedModel(modelId: string) {
  return (
    chatModelOptions.find((model) => model.id === modelId) ??
    chatModelOptions[0]
  );
}

function getModelName(modelId?: string) {
  if (!modelId) {
    return undefined;
  }

  return getGroqModelName(modelId);
}

function getMessageModelLabel(message: ChatMessage, fallbackModelId: string) {
  return (
    message.modelName ??
    getModelName(message.modelId) ??
    getModelName(fallbackModelId) ??
    fallbackModelId
  );
}

function getActiveChatModelId(modelId?: string) {
  if (modelId && isSelectableChatModel(modelId)) {
    return modelId;
  }

  return GROQ_MODEL_NAME;
}

function getChatSessionSnapshot(session: ChatSessionSnapshotInput) {
  return JSON.stringify({
    chatTitle: session.chatTitle,
    hasCustomTitle: session.hasCustomTitle,
    messages: session.messages,
    model: session.model,
  });
}

function getChatSessionTimestampSnapshot(
  session: Omit<ChatSessionSnapshotInput, "model">,
) {
  return JSON.stringify({
    chatTitle: session.chatTitle,
    hasCustomTitle: session.hasCustomTitle,
    messages: session.messages,
  });
}

function isCompoundModel(modelId: string) {
  return (
    modelId === GROQ_MODEL_IDS.groqCompound ||
    modelId === GROQ_MODEL_IDS.groqCompoundMini
  );
}

function shouldEnableWebSearchByDefault(modelId: string) {
  return !isMovieBotMode && supportsWebSearch(modelId);
}

function getModelCapabilityTags(model: ChatModelOption) {
  const capabilityTags: string[] = [];

  if (supportsVision(model.id)) {
    capabilityTags.push("Vision");
  }

  if (supportsWebSearch(model.id)) {
    capabilityTags.push("Web Search");
  }

  return [...capabilityTags, ...model.traits];
}

function getCapabilityTagClassName(tag: string) {
  return `model-capability-tag model-capability-tag--${tag
    .toLowerCase()
    .replace(/\s+/g, "-")}`;
}

function isSupportedImageMimeType(
  mimeType: string,
): mimeType is ChatImageAttachment["mimeType"] {
  return imageMimeTypes.includes(mimeType as ChatImageAttachment["mimeType"]);
}

function readImageAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Could not read the selected image file."));
    });

    reader.addEventListener("error", () => {
      reject(new Error("Could not read the selected image file."));
    });

    reader.readAsDataURL(file);
  });
}

function isValidImageDataUrl(dataUrl: string) {
  return /^data:image\/(?:png|jpeg|webp);base64,/i.test(dataUrl);
}

function isBlankMarkdownLine(line: string) {
  return line.trim().length === 0;
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function cleanTableCell(cell: string) {
  return cell.replace(/^-\s+/, "").trim();
}

function isTableSeparator(line: string, expectedCellCount?: number) {
  const cells = splitTableRow(line);

  return (
    cells.length > 1 &&
    (expectedCellCount === undefined || cells.length === expectedCellCount) &&
    cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, "")))
  );
}

function isTableDataRow(line: string) {
  return (
    !isBlankMarkdownLine(line) &&
    line.includes("|") &&
    splitTableRow(line).length > 1
  );
}

function isTableStart(lines: string[], index: number) {
  const headerCells = splitTableRow(lines[index] ?? "");

  return (
    index + 2 < lines.length &&
    lines[index].includes("|") &&
    headerCells.length > 1 &&
    isTableSeparator(lines[index + 1], headerCells.length) &&
    isTableDataRow(lines[index + 2])
  );
}

function cleanPipeSeparatedTextLine(line: string) {
  if (/^\s*\|\s*$/.test(line)) {
    return "";
  }

  return line
    .replace(/^(\s*)\|\s*/, "$1")
    .replace(/[ \t]*\|\s*$/, "");
}

function getUnorderedListItem(line: string) {
  return line.match(/^\s*[-*]\s+(.+)$/)?.[1];
}

function getOrderedListItem(line: string) {
  const match = line.match(/^\s*(\d+)[.)]\s+(.+)$/);

  if (!match) {
    return null;
  }

  return {
    number: Number(match[1]),
    text: match[2],
  };
}

function getListContinuationLine(line: string) {
  if (
    isBlankMarkdownLine(line) ||
    getHeadingLine(line) ||
    getUnorderedListItem(line) ||
    getOrderedListItem(line)
  ) {
    return null;
  }

  if (/^\s{2,}\S/.test(line) || /^\s*Alasan\s*:/i.test(line)) {
    return line.trim();
  }

  return null;
}

function getHeadingLine(line: string) {
  const heading = line.match(/^(#{1,3})\s+(.+)$/);

  if (!heading) {
    return null;
  }

  return {
    level: heading[1].length as 1 | 2 | 3,
    text: heading[2].trim(),
  };
}

function isBulletLikeContinuationLine(line: string) {
  return /^\s*(?:[•*-])\s+\S/.test(line);
}

function isParentheticalContinuationLine(line: string) {
  return /^\s*\(.+\)[.!?]?\s*$/.test(line);
}

function isPlainContinuationLine(line: string, previousCell?: string) {
  const trimmedLine = line.trim();
  const trimmedCell = previousCell?.trim() ?? "";
  const previousCellLooksIncomplete = Boolean(
    trimmedCell &&
      /(?:(?:[:;,]|\(|\[)|\b(?:and|or|dan|atau|serta|yang|dengan|untuk|karena|sehingga|mis\.|contoh|e\.g\.|i\.e\.)\s*)$/i.test(
        trimmedCell,
      ),
  );

  return (
    /^\s{2,}\S/.test(line) ||
    /^[,.;:)]/.test(trimmedLine) ||
    /^(?:and|or|dan|atau|serta|yang|dengan|untuk|karena|sehingga|mis\.|contoh|e\.g\.|i\.e\.)\b/i.test(
      trimmedLine,
    ) ||
    previousCellLooksIncomplete
  );
}

function isTableContinuationLine(
  lines: string[],
  index: number,
  previousCell?: string,
) {
  const line = lines[index] ?? "";

  if (
    isBlankMarkdownLine(line) ||
    line.includes("|") ||
    getHeadingLine(line) ||
    isTableStart(lines, index)
  ) {
    return false;
  }

  return (
    isBulletLikeContinuationLine(line) ||
    isParentheticalContinuationLine(line) ||
    isPlainContinuationLine(line, previousCell)
  );
}

function getLastNonEmptyCellIndex(row: string[]) {
  for (let index = row.length - 1; index >= 0; index -= 1) {
    if (row[index]?.trim()) {
      return index;
    }
  }

  return Math.max(row.length - 1, 0);
}

function getLastNonEmptyTableCell(rows: string[][]) {
  const row = rows.at(-1);

  if (!row) {
    return undefined;
  }

  return row[getLastNonEmptyCellIndex(row)];
}

function getLastNonEmptyTableCellFromLine(line: string) {
  const cells = splitTableRow(line).map(cleanTableCell);

  return cells[getLastNonEmptyCellIndex(cells)];
}

function appendTableContinuationLine(rows: string[][], line: string) {
  const row = rows.at(-1);

  if (!row) {
    return;
  }

  const cellIndex = getLastNonEmptyCellIndex(row);
  const currentCell = row[cellIndex]?.trim() ?? "";
  const continuationLine = line.trim();

  row[cellIndex] = [currentCell, continuationLine].filter(Boolean).join("\n");
}

function parseAssistantMarkdown(content: string) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (isBlankMarkdownLine(line)) {
      index += 1;
      continue;
    }

    const heading = getHeadingLine(line);

    if (heading) {
      blocks.push({
        type: "heading",
        level: heading.level,
        text: heading.text,
      });
      index += 1;
      continue;
    }

    if (isTableStart(lines, index)) {
      const headers = splitTableRow(line).map(cleanTableCell);
      const rows: string[][] = [];

      index += 2;

      while (index < lines.length) {
        if (isTableDataRow(lines[index])) {
          rows.push(splitTableRow(lines[index]).map(cleanTableCell));
          index += 1;
          continue;
        }

        if (
          rows.length > 0 &&
          isTableContinuationLine(
            lines,
            index,
            getLastNonEmptyTableCell(rows),
          )
        ) {
          appendTableContinuationLine(rows, lines[index]);
          index += 1;
          continue;
        }

        break;
      }

      blocks.push({
        type: "table",
        headers,
        rows,
      });
      continue;
    }

    const unorderedItem = getUnorderedListItem(line);

    if (unorderedItem) {
      const items: string[] = [];

      while (index < lines.length) {
        const item = getUnorderedListItem(lines[index]);

        if (!item) {
          break;
        }

        index += 1;
        const itemLines = [item];

        while (index < lines.length && !isTableStart(lines, index)) {
          const continuationLine = getListContinuationLine(lines[index]);

          if (continuationLine === null) {
            break;
          }

          itemLines.push(continuationLine);
          index += 1;
        }

        items.push(itemLines.join("\n"));
      }

      blocks.push({
        type: "unordered-list",
        items,
      });
      continue;
    }

    const orderedItem = getOrderedListItem(line);

    if (orderedItem) {
      const items: string[] = [];
      const start = orderedItem.number;

      while (index < lines.length) {
        const item = getOrderedListItem(lines[index]);

        if (!item) {
          break;
        }

        index += 1;
        const itemLines = [item.text];

        while (index < lines.length && !isTableStart(lines, index)) {
          const continuationLine = getListContinuationLine(lines[index]);

          if (continuationLine === null) {
            break;
          }

          itemLines.push(continuationLine);
          index += 1;
        }

        items.push(itemLines.join("\n"));
      }

      blocks.push({
        type: "ordered-list",
        items,
        start,
      });
      continue;
    }

    const paragraphLines: string[] = [];

    while (
      index < lines.length &&
      !isBlankMarkdownLine(lines[index]) &&
      !getHeadingLine(lines[index]) &&
      !isTableStart(lines, index) &&
      !getUnorderedListItem(lines[index]) &&
      !getOrderedListItem(lines[index])
    ) {
      paragraphLines.push(lines[index]);
      index += 1;
    }

    blocks.push({
      type: "paragraph",
      lines: paragraphLines,
    });
  }

  return blocks;
}

function removeStrayPipeCharacters(content: string) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const cleanedLines: string[] = [];
  let index = 0;

  while (index < lines.length) {
    if (isTableStart(lines, index)) {
      cleanedLines.push(lines[index], lines[index + 1]);
      index += 2;
      let previousCell: string | undefined;

      while (index < lines.length) {
        if (isTableDataRow(lines[index])) {
          previousCell = getLastNonEmptyTableCellFromLine(lines[index]);
          cleanedLines.push(lines[index]);
          index += 1;
          continue;
        }

        if (isTableContinuationLine(lines, index, previousCell)) {
          const continuationLine = lines[index].trim();

          previousCell = [previousCell?.trim(), continuationLine]
            .filter(Boolean)
            .join("\n");
          cleanedLines.push(lines[index]);
          index += 1;
          continue;
        }

        break;
      }

      continue;
    }

    const cleanedLine = lines[index]
      .replace(/^\s*\|\s*$/g, "")
      .replace(/[ \t]+\|[ \t]*$/g, "");

    cleanedLines.push(cleanPipeSeparatedTextLine(cleanedLine));
    index += 1;
  }

  return cleanedLines.join("\n");
}

function removeMarkdownHorizontalRules(content: string) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const cleanedLines: string[] = [];
  let index = 0;

  while (index < lines.length) {
    if (isTableStart(lines, index)) {
      cleanedLines.push(lines[index], lines[index + 1]);
      index += 2;
      let previousCell: string | undefined;

      while (index < lines.length) {
        if (isTableDataRow(lines[index])) {
          previousCell = getLastNonEmptyTableCellFromLine(lines[index]);
          cleanedLines.push(lines[index]);
          index += 1;
          continue;
        }

        if (isTableContinuationLine(lines, index, previousCell)) {
          const continuationLine = lines[index].trim();

          previousCell = [previousCell?.trim(), continuationLine]
            .filter(Boolean)
            .join("\n");
          cleanedLines.push(lines[index]);
          index += 1;
          continue;
        }

        break;
      }

      continue;
    }

    if (/^\s*-{3,}\s*$/.test(lines[index])) {
      cleanedLines.push("");
      index += 1;
      continue;
    }

    cleanedLines.push(lines[index].replace(/\s*-{3,}\s*/g, " "));
    index += 1;
  }

  return cleanedLines.join("\n");
}

function cleanAssistantDisplayContent(content: string) {
  const normalizedContent = content
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<p\s*>/gi, "")
    .replace(/【[^】]*†[^】]*】/g, "")
    .replace(/[ \t]+\n/g, "\n");

  return removeMarkdownHorizontalRules(removeStrayPipeCharacters(normalizedContent))
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function renderItalicMarkdown(
  text: string,
  keyPrefix: string,
  indexOffset = 0,
) {
  const nodes: ReactNode[] = [];
  const italicPattern =
    /(^|[^\w*_])(?:\*(?![\s*])([^*\n]*?\S)\*(?!\*)|_(?![\s_])([^_\n]*?\S)_(?![\w_]))/g;
  let lastIndex = 0;
  let match = italicPattern.exec(text);

  while (match) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const prefix = match[1];
    const italicText = match[2] ?? match[3] ?? "";

    if (prefix) {
      nodes.push(prefix);
    }

    nodes.push(
      <em key={`${keyPrefix}-italic-${indexOffset + match.index}`}>
        {italicText}
      </em>,
    );
    lastIndex = match.index + match[0].length;
    match = italicPattern.exec(text);
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function renderInlineMarkdown(text: string, keyPrefix: string) {
  const nodes: ReactNode[] = [];
  const boldPattern = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match = boldPattern.exec(text);

  while (match) {
    if (match.index > lastIndex) {
      nodes.push(
        ...renderItalicMarkdown(
          text.slice(lastIndex, match.index),
          `${keyPrefix}-plain-${lastIndex}`,
          lastIndex,
        ),
      );
    }

    nodes.push(
      <strong key={`${keyPrefix}-bold-${match.index}`}>
        {renderItalicMarkdown(match[1], `${keyPrefix}-bold-${match.index}`)}
      </strong>,
    );
    lastIndex = match.index + match[0].length;
    match = boldPattern.exec(text);
  }

  if (lastIndex < text.length) {
    nodes.push(
      ...renderItalicMarkdown(
        text.slice(lastIndex),
        `${keyPrefix}-plain-${lastIndex}`,
        lastIndex,
      ),
    );
  }

  return nodes;
}

function renderMarkdownLines(lines: string[], keyPrefix: string) {
  return lines.flatMap((line, index) => {
    const inlineNodes = renderInlineMarkdown(line, `${keyPrefix}-line-${index}`);

    if (index === 0) {
      return inlineNodes;
    }

    return [
      <br key={`${keyPrefix}-break-${index}`} />,
      ...inlineNodes,
    ];
  });
}

function renderTableCellMarkdown(text: string, keyPrefix: string) {
  return renderMarkdownLines(text.split("\n"), keyPrefix);
}

function getAssistantMarkdownBlocks(content: string) {
  return parseAssistantMarkdown(cleanAssistantDisplayContent(content));
}

function AssistantMarkdown({ content }: { content: string }) {
  const blocks = getAssistantMarkdownBlocks(content);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className="assistant-markdown">
      {blocks.map((block, blockIndex) => {
        if (block.type === "heading") {
          const headingContent = renderInlineMarkdown(
            block.text,
            `heading-${blockIndex}`,
          );

          if (block.level === 1) {
            return (
              <h3
                className="assistant-heading assistant-heading--1"
                key={`heading-${blockIndex}`}
              >
                {headingContent}
              </h3>
            );
          }

          if (block.level === 2) {
            return (
              <h4
                className="assistant-heading assistant-heading--2"
                key={`heading-${blockIndex}`}
              >
                {headingContent}
              </h4>
            );
          }

          return (
            <h5
              className="assistant-heading assistant-heading--3"
              key={`heading-${blockIndex}`}
            >
              {headingContent}
            </h5>
          );
        }

        if (block.type === "paragraph") {
          return (
            <p key={`paragraph-${blockIndex}`}>
              {renderMarkdownLines(block.lines, `paragraph-${blockIndex}`)}
            </p>
          );
        }

        if (block.type === "unordered-list") {
          return (
            <ul key={`unordered-list-${blockIndex}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`${blockIndex}-${itemIndex}`}>
                  {renderMarkdownLines(
                    item.split("\n"),
                    `${blockIndex}-${itemIndex}`,
                  )}
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "ordered-list") {
          return (
            <ol key={`ordered-list-${blockIndex}`} start={block.start}>
              {block.items.map((item, itemIndex) => (
                <li key={`${blockIndex}-${itemIndex}`}>
                  {renderMarkdownLines(
                    item.split("\n"),
                    `${blockIndex}-${itemIndex}`,
                  )}
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === "table") {
          return (
            <AssistantMarkdownTable
              block={block}
              blockIndex={blockIndex}
              key={`table-${blockIndex}`}
            />
          );
        }

        return null;
      })}
    </div>
  );
}

function AssistantMarkdownTable({
  block,
  blockIndex,
}: {
  block: MarkdownTableBlock;
  blockIndex: number;
}) {
  return (
    <div className="markdown-table-wrap">
      <p className="markdown-table-helper">
        Scroll tabel untuk melihat informasi lengkap
      </p>
      <table>
        <thead>
          <tr>
            {block.headers.map((header, headerIndex) => (
              <th key={`${blockIndex}-header-${headerIndex}`}>
                {renderInlineMarkdown(
                  header,
                  `${blockIndex}-header-${headerIndex}`,
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={`${blockIndex}-row-${rowIndex}`}>
              {block.headers.map((_, cellIndex) => (
                <td key={`${blockIndex}-cell-${rowIndex}-${cellIndex}`}>
                  {renderTableCellMarkdown(
                    row[cellIndex] ?? "",
                    `${blockIndex}-cell-${rowIndex}-${cellIndex}`,
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AssistantMessageContent({ message }: { message: ChatMessage }) {
  return (
    <div className="message-bubble">
      <AssistantMarkdown content={message.content} />
      {message.sources && message.sources.length > 0 && (
        <AssistantSources sources={message.sources} />
      )}
    </div>
  );
}

function SourceCard({
  className = "",
  index,
  source,
}: {
  className?: string;
  index: number;
  source: ChatSource;
}) {
  const domain = getSourceDomain(source);
  const title = getSourceTitle(source, index);
  const sourceContent = (
    <>
      <span className="message-source-icon" aria-hidden="true">
        <span className="material-symbols-outlined">language</span>
      </span>
      <span className="message-source-text">
        <span className="message-source-title">{title}</span>
        {domain && <span className="message-source-domain">{domain}</span>}
        {source.snippet && (
          <span className="message-source-snippet">{source.snippet}</span>
        )}
      </span>
      {source.url && (
        <span
          className="material-symbols-outlined message-source-open"
          aria-hidden="true"
        >
          open_in_new
        </span>
      )}
    </>
  );
  const cardClassName = `message-source-card ${className}`.trim();

  if (source.url) {
    return (
      <a
        className={cardClassName}
        href={source.url}
        rel="noreferrer"
        target="_blank"
      >
        {sourceContent}
      </a>
    );
  }

  return <div className={cardClassName}>{sourceContent}</div>;
}

function AssistantSources({ sources }: { sources: ChatSource[] }) {
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const displaySources = getDisplayableSources(sources);
  const visibleSources = displaySources.slice(0, 3);
  const hiddenSourceCount = displaySources.length - visibleSources.length;

  useEffect(() => {
    if (!isSourceModalOpen) {
      return;
    }

    function handleEscapeKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setIsSourceModalOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscapeKey);

    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isSourceModalOpen]);

  if (displaySources.length === 0) {
    return null;
  }

  return (
    <div className="message-sources">
      <div className="message-sources-title">Sources</div>
      <div className="message-source-list">
        {visibleSources.map((source, index) => (
          <SourceCard
            index={index}
            key={`${source.url ?? source.title ?? "source"}-${index}`}
            source={source}
          />
        ))}
      </div>
      {hiddenSourceCount > 0 && (
        <button
          className="message-sources-more"
          type="button"
          onClick={() => setIsSourceModalOpen(true)}
        >
          +{hiddenSourceCount} more sources
        </button>
      )}

      {isSourceModalOpen && (
        <div
          className="sources-modal-backdrop"
          role="presentation"
          onClick={() => setIsSourceModalOpen(false)}
        >
          <section
            aria-modal="true"
            className="sources-modal"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sources-modal-header">
              <div>
                <h2>Sources</h2>
                <p>Web results used for this response</p>
              </div>
              <button
                type="button"
                aria-label="Close sources"
                onClick={() => setIsSourceModalOpen(false)}
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  close
                </span>
              </button>
            </div>
            <div className="sources-modal-list">
              {displaySources.map((source, index) => (
                <SourceCard
                  className="sources-modal-source"
                  index={index}
                  key={`${source.url ?? source.title ?? "source"}-${index}`}
                  source={source}
                />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function MessageImageAttachment({ image }: { image: ChatImageAttachment }) {
  const fileName = image.fileName ?? image.name;

  return (
    <div className="message-image-attachment">
      <img
        alt=""
        className="message-image-thumbnail"
        src={image.dataUrl}
      />
      <span className="message-image-meta">
        <span className="message-image-name">{fileName}</span>
        <span className="message-image-type">{image.mimeType}</span>
      </span>
    </div>
  );
}

type AppRoute = "chat" | "history" | "library";

function getAppRoute(): AppRoute {
  if (typeof window !== "undefined") {
    if (window.location.pathname === "/history-chat") {
      return "history";
    }

    if (window.location.pathname === "/library") {
      return "library";
    }
  }

  return "chat";
}

function Chatbot({ onLogout }: ChatbotProps) {
  const [initialRoute] = useState<AppRoute>(() => getAppRoute());
  const [route, setRoute] = useState<AppRoute>(() => initialRoute);
  const [initialUrlChatId] = useState(() =>
    initialRoute === "chat" ? getChatIdFromUrl() : null,
  );
  const [initialSavedSession] = useState(() =>
    loadChatSession(initialUrlChatId),
  );
  const [messages, setMessages] = useState<ChatMessage[]>(
    () => initialSavedSession?.messages ?? [],
  );
  const [chatId, setChatId] = useState<string | null>(
    () => initialSavedSession?.chatId ?? null,
  );
  const [currentModelId, setCurrentModelId] = useState(
    () => getActiveChatModelId(initialSavedSession?.model),
  );
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isChatMoreMenuOpen, setIsChatMoreMenuOpen] = useState(false);
  const [isDeleteChatModalOpen, setIsDeleteChatModalOpen] = useState(false);
  const [showDeleteToast, setShowDeleteToast] = useState(false);
  const [chatTitle, setChatTitle] = useState(
    () => initialSavedSession?.chatTitle || "New Chat",
  );
  const [isRenamingTitle, setIsRenamingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(
    () => initialSavedSession?.chatTitle || "New Chat",
  );
  const [hasCustomTitle, setHasCustomTitle] = useState(
    () => initialSavedSession?.hasCustomTitle ?? false,
  );
  const [selectedAttachment, setSelectedAttachment] =
    useState<SelectedAttachment | null>(null);
  const [isWebSearchMode, setIsWebSearchMode] = useState(() =>
    shouldEnableWebSearchByDefault(
      getActiveChatModelId(initialSavedSession?.model),
    ),
  );
  const [isTextareaExpanded, setIsTextareaExpanded] = useState(false);
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(
    null,
  );
  const [editingDraft, setEditingDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const composerWrapRef = useRef<HTMLFormElement | null>(null);
  const modelSelectorRef = useRef<HTMLDivElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const chatMoreMenuRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const hasCustomTitleRef = useRef(initialSavedSession?.hasCustomTitle ?? false);
  const hasGeneratedTitleRef = useRef(
    (initialSavedSession?.messages.length ?? 0) > 0,
  );
  const isRestoringSessionRef = useRef(Boolean(initialSavedSession));
  const lastSavedSessionSnapshotRef = useRef(
    initialSavedSession
      ? getChatSessionSnapshot({
          chatTitle: initialSavedSession.chatTitle || "New Chat",
          hasCustomTitle: initialSavedSession.hasCustomTitle,
          messages: initialSavedSession.messages,
          model: getActiveChatModelId(initialSavedSession.model),
        })
      : "",
  );
  const lastTimestampSnapshotRef = useRef(
    initialSavedSession
      ? getChatSessionTimestampSnapshot({
          chatTitle: initialSavedSession.chatTitle || "New Chat",
          hasCustomTitle: initialSavedSession.hasCustomTitle,
          messages: initialSavedSession.messages,
        })
      : "",
  );
  const lastSavedUpdatedAtRef = useRef(initialSavedSession?.updatedAt ?? "");

  const hasMessages = messages.length > 0;
  const isHistoryRoute = route === "history";
  const isLibraryRoute = route === "library";
  const shellMode = isHistoryRoute
    ? "is-history"
    : isLibraryRoute
      ? "is-library"
    : hasMessages
      ? "is-chat"
      : "is-welcome";
  const canSend = input.trim().length > 0 && !isLoading;
  const latestAssistantMessageIndex = getLatestAssistantMessageIndex(messages);
  const selectedModel = getSelectedModel(currentModelId);
  const selectedModelCapabilityTags = getModelCapabilityTags(selectedModel);
  const canUseImageInput = supportsVision(currentModelId);
  const canUseWebSearch = supportsWebSearch(currentModelId) && !isMovieBotMode;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, error]);

  useEffect(() => {
    hasCustomTitleRef.current = hasCustomTitle;
  }, [hasCustomTitle]);

  useEffect(() => {
    if (!showDeleteToast) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setShowDeleteToast(false);
    }, 2600);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [showDeleteToast]);

  useEffect(() => {
    if (initialUrlChatId && !initialSavedSession) {
      resetChatUrl();
    }
  }, [initialSavedSession, initialUrlChatId]);

  useEffect(() => {
    function handlePopStateEvent() {
      const nextRoute = getAppRoute();

      setRoute(nextRoute);
      setIsSidebarOpen(false);
      setIsAttachmentMenuOpen(false);
      setIsModelSelectorOpen(false);
      setIsProfileMenuOpen(false);
      setIsChatMoreMenuOpen(false);
      setIsDeleteChatModalOpen(false);
      setShowDeleteToast(false);

      if (nextRoute !== "chat") {
        return;
      }

      const nextChatId = getChatIdFromUrl();
      const savedSession = loadChatSession(nextChatId);

      if (savedSession) {
        const savedModelId = getActiveChatModelId(savedSession.model);

        isRestoringSessionRef.current = true;
        lastSavedSessionSnapshotRef.current = getChatSessionSnapshot({
          chatTitle: savedSession.chatTitle || "New Chat",
          hasCustomTitle: savedSession.hasCustomTitle,
          messages: savedSession.messages,
          model: savedModelId,
        });
        lastTimestampSnapshotRef.current = getChatSessionTimestampSnapshot({
          chatTitle: savedSession.chatTitle || "New Chat",
          hasCustomTitle: savedSession.hasCustomTitle,
          messages: savedSession.messages,
        });
        lastSavedUpdatedAtRef.current = savedSession.updatedAt;
        setMessages(savedSession.messages);
        setChatId(savedSession.chatId);
        setInput("");
        setError("");
        setIsLoading(false);
        setChatTitle(savedSession.chatTitle || "New Chat");
        setCurrentModelId(savedModelId);
        setIsRenamingTitle(false);
        setDraftTitle(savedSession.chatTitle || "New Chat");
        setHasCustomTitle(savedSession.hasCustomTitle);
        setSelectedAttachment(null);
        setIsWebSearchMode(shouldEnableWebSearchByDefault(savedModelId));
        setIsTextareaExpanded(false);
        setEditingMessageIndex(null);
        setEditingDraft("");
        hasCustomTitleRef.current = savedSession.hasCustomTitle;
        hasGeneratedTitleRef.current = savedSession.messages.length > 0;
        return;
      }

      setMessages([]);
      setChatId(null);
      setInput("");
      setError("");
      setIsLoading(false);
      setChatTitle("New Chat");
      setCurrentModelId(GROQ_MODEL_NAME);
      setIsRenamingTitle(false);
      setDraftTitle("New Chat");
      setHasCustomTitle(false);
      setSelectedAttachment(null);
      setIsWebSearchMode(false);
      setIsTextareaExpanded(false);
      setEditingMessageIndex(null);
      setEditingDraft("");
      hasCustomTitleRef.current = false;
      hasGeneratedTitleRef.current = false;
      isRestoringSessionRef.current = false;
      lastSavedSessionSnapshotRef.current = "";
      lastTimestampSnapshotRef.current = "";
      lastSavedUpdatedAtRef.current = "";
    }

    window.addEventListener("popstate", handlePopStateEvent);

    return () => {
      window.removeEventListener("popstate", handlePopStateEvent);
    };
  }, []);

  useEffect(() => {
    if (!chatId || messages.length === 0) {
      return;
    }

    const sessionSnapshot = getChatSessionSnapshot({
      chatTitle,
      hasCustomTitle,
      messages,
      model: currentModelId,
    });

    if (
      isRestoringSessionRef.current ||
      sessionSnapshot === lastSavedSessionSnapshotRef.current
    ) {
      isRestoringSessionRef.current = false;
      return;
    }

    const timestampSnapshot = getChatSessionTimestampSnapshot({
      chatTitle,
      hasCustomTitle,
      messages,
    });
    const shouldUpdateTimestamp =
      timestampSnapshot !== lastTimestampSnapshotRef.current;
    const nextUpdatedAt = shouldUpdateTimestamp
      ? new Date().toISOString()
      : lastSavedUpdatedAtRef.current || new Date().toISOString();

    saveChatSession({
      chatId,
      chatTitle,
      hasCustomTitle,
      messages,
      model: currentModelId,
      updatedAt: nextUpdatedAt,
    });

    lastSavedSessionSnapshotRef.current = sessionSnapshot;
    lastTimestampSnapshotRef.current = timestampSnapshot;
    lastSavedUpdatedAtRef.current = nextUpdatedAt;
  }, [chatId, chatTitle, currentModelId, hasCustomTitle, messages]);

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    const maxHeight = Number.parseFloat(
      window.getComputedStyle(textarea).maxHeight,
    );
    const minHeight = Number.parseFloat(
      window.getComputedStyle(textarea).minHeight,
    );
    const textareaMaxHeight = Number.isNaN(maxHeight) ? 150 : maxHeight;
    const textareaMinHeight = Number.isNaN(minHeight) ? 24 : minHeight;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(
      textarea.scrollHeight,
      textareaMaxHeight,
    )}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > textareaMaxHeight ? "auto" : "hidden";
    setIsTextareaExpanded(textarea.scrollHeight > textareaMinHeight + 4);
  }, [input]);

  useEffect(() => {
    if (
      !isAttachmentMenuOpen &&
      !isModelSelectorOpen &&
      !isProfileMenuOpen &&
      !isChatMoreMenuOpen
    ) {
      return;
    }

    function handleOutsidePointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (isAttachmentMenuOpen && !composerWrapRef.current?.contains(target)) {
        setIsAttachmentMenuOpen(false);
      }

      if (isModelSelectorOpen && !modelSelectorRef.current?.contains(target)) {
        setIsModelSelectorOpen(false);
      }

      if (isProfileMenuOpen && !profileMenuRef.current?.contains(target)) {
        setIsProfileMenuOpen(false);
      }

      if (isChatMoreMenuOpen && !chatMoreMenuRef.current?.contains(target)) {
        setIsChatMoreMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleOutsidePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointerDown);
    };
  }, [
    isAttachmentMenuOpen,
    isModelSelectorOpen,
    isProfileMenuOpen,
    isChatMoreMenuOpen,
  ]);

  useEffect(() => {
    if (!isModelSelectorOpen) {
      return;
    }

    function handleEscapeKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setIsModelSelectorOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscapeKey);

    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isModelSelectorOpen]);

  function applyCurrentModelId(nextModelId: string) {
    const shouldRemoveImage =
      selectedAttachment?.type === "image" && !supportsVision(nextModelId);

    setCurrentModelId(nextModelId);
    setIsWebSearchMode(shouldEnableWebSearchByDefault(nextModelId));

    if (!supportsVision(nextModelId)) {
      setSelectedAttachment((currentAttachment) =>
        currentAttachment?.type === "image" ? null : currentAttachment,
      );
    }

    if (shouldRemoveImage) {
      setError(
        "Selected image removed because this model does not support image Q&A. Switch to Llama 4 Scout to use images.",
      );
    }
  }

  async function sendMessage(messageText: string) {
    const cleanMessage = messageText.trim();

    if (!cleanMessage || isLoading) {
      return;
    }

    if (!chatId) {
      const nextChatId = generateChatId();

      setChatId(nextChatId);
      setChatUrl(nextChatId);
    }

    const userMessage: ChatMessage = {
      role: "user",
      content: cleanMessage,
      createdAt: new Date().toISOString(),
    };
    const selectedImage =
      selectedAttachment?.type === "image" &&
      selectedAttachment.dataUrl &&
      selectedAttachment.mimeType
        ? {
            name: selectedAttachment.name,
            fileName: selectedAttachment.name,
            mimeType: selectedAttachment.mimeType,
            dataUrl: selectedAttachment.dataUrl,
          }
        : null;

    if (selectedAttachment?.type === "image") {
      if (!canUseImageInput) {
        setError(
          "This model cannot process the selected image. Please switch to Llama 4 Scout.",
        );
        return;
      }

      if (!selectedImage || !isValidImageDataUrl(selectedImage.dataUrl)) {
        setError("Selected image is not ready. Please choose the image again.");
        return;
      }

      userMessage.image = selectedImage;
    }

    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setError("");
    setIsLoading(true);

    try {
      const responseModelId = currentModelId;
      const responseModelName = getModelName(responseModelId) ?? responseModelId;
      const assistantResponse = await sendChatMessage(nextMessages, {
        modelId: responseModelId,
        webSearchEnabled: isWebSearchMode,
      });
      const assistantMessage = createAssistantMessage(
        assistantResponse.content,
        responseModelId,
        responseModelName,
        assistantResponse.tokens,
        assistantResponse.sources,
      );

      setMessages([...nextMessages, assistantMessage]);
      setSelectedAttachment((currentAttachment) =>
        currentAttachment?.type === "image" ? null : currentAttachment,
      );

      if (!hasCustomTitleRef.current && !hasGeneratedTitleRef.current) {
        setChatTitle(createChatTitle(userMessage.content));
        hasGeneratedTitleRef.current = true;
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRegenerate(messageIndex: number) {
    if (isLoading || messageIndex !== latestAssistantMessageIndex) {
      return;
    }

    const conversationBeforeResponse = messages.slice(0, messageIndex);
    const previousMessages = messages;

    setMessages(conversationBeforeResponse);
    setError("");
    setIsLoading(true);

    try {
      const responseModelId = currentModelId;
      const responseModelName = getModelName(responseModelId) ?? responseModelId;
      const assistantResponse = await sendChatMessage(
        conversationBeforeResponse,
        {
          modelId: responseModelId,
          webSearchEnabled: isWebSearchMode,
        },
      );
      const regeneratedMessage = createAssistantMessage(
        assistantResponse.content,
        responseModelId,
        responseModelName,
        assistantResponse.tokens,
        assistantResponse.sources,
      );

      setMessages([...conversationBeforeResponse, regeneratedMessage]);
    } catch (requestError) {
      setMessages(previousMessages);
      setError(getErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }

  function handleStartEdit(index: number, content: string) {
    if (isLoading) {
      return;
    }

    setEditingMessageIndex(index);
    setEditingDraft(content);
    setError("");
  }

  function handleCancelEdit() {
    setEditingMessageIndex(null);
    setEditingDraft("");
  }

  function clearActiveChatState() {
    setMessages([]);
    setChatId(null);
    applyCurrentModelId(GROQ_MODEL_NAME);
    setInput("");
    setError("");
    setIsLoading(false);
    setIsSidebarOpen(false);
    setIsAttachmentMenuOpen(false);
    setIsModelSelectorOpen(false);
    setIsProfileMenuOpen(false);
    setIsChatMoreMenuOpen(false);
    setIsDeleteChatModalOpen(false);
    setShowDeleteToast(false);
    setChatTitle("New Chat");
    setIsRenamingTitle(false);
    setDraftTitle("New Chat");
    setHasCustomTitle(false);
    setSelectedAttachment(null);
    setIsWebSearchMode(false);
    setIsTextareaExpanded(false);
    setEditingMessageIndex(null);
    setEditingDraft("");
    hasCustomTitleRef.current = false;
    hasGeneratedTitleRef.current = false;
    isRestoringSessionRef.current = false;
    lastSavedSessionSnapshotRef.current = "";
    lastTimestampSnapshotRef.current = "";
    lastSavedUpdatedAtRef.current = "";
  }

  function restoreSavedChatSession(session: SavedChatSession) {
    const savedModelId = getActiveChatModelId(session.model);

    isRestoringSessionRef.current = true;
    lastSavedSessionSnapshotRef.current = getChatSessionSnapshot({
      chatTitle: session.chatTitle || "New Chat",
      hasCustomTitle: session.hasCustomTitle,
      messages: session.messages,
      model: savedModelId,
    });
    lastTimestampSnapshotRef.current = getChatSessionTimestampSnapshot({
      chatTitle: session.chatTitle || "New Chat",
      hasCustomTitle: session.hasCustomTitle,
      messages: session.messages,
    });
    lastSavedUpdatedAtRef.current = session.updatedAt;
    setRoute("chat");
    setMessages(session.messages);
    setChatId(session.chatId);
    applyCurrentModelId(savedModelId);
    setInput("");
    setError("");
    setIsLoading(false);
    setIsSidebarOpen(false);
    setIsAttachmentMenuOpen(false);
    setIsModelSelectorOpen(false);
    setIsProfileMenuOpen(false);
    setIsChatMoreMenuOpen(false);
    setIsDeleteChatModalOpen(false);
    setShowDeleteToast(false);
    setChatTitle(session.chatTitle || "New Chat");
    setIsRenamingTitle(false);
    setDraftTitle(session.chatTitle || "New Chat");
    setHasCustomTitle(session.hasCustomTitle);
    setSelectedAttachment(null);
    setIsWebSearchMode(shouldEnableWebSearchByDefault(savedModelId));
    setIsTextareaExpanded(false);
    setEditingMessageIndex(null);
    setEditingDraft("");
    hasCustomTitleRef.current = session.hasCustomTitle;
    hasGeneratedTitleRef.current = session.messages.length > 0;
  }

  function handleNewChat() {
    resetChatUrl();
    setRoute("chat");
    clearActiveChatState();
  }

  function handleHistoryNavigation() {
    window.history.pushState({}, "", "/history-chat");
    setRoute("history");
    setIsSidebarOpen(false);
    setIsAttachmentMenuOpen(false);
    setIsModelSelectorOpen(false);
    setIsProfileMenuOpen(false);
    setIsChatMoreMenuOpen(false);
    setIsDeleteChatModalOpen(false);
  }

  function handleLibraryNavigation() {
    window.history.pushState({}, "", "/library");
    setRoute("library");
    setIsSidebarOpen(false);
    setIsAttachmentMenuOpen(false);
    setIsModelSelectorOpen(false);
    setIsProfileMenuOpen(false);
    setIsChatMoreMenuOpen(false);
    setIsDeleteChatModalOpen(false);
  }

  function handleOpenHistoryChat(nextChatId: string) {
    const savedSession = loadChatSession(nextChatId);

    if (!savedSession) {
      return;
    }

    setChatUrl(nextChatId);
    restoreSavedChatSession(savedSession);
  }

  function handleDeleteHistoryChat(deletedChatId: string) {
    if (deletedChatId === chatId) {
      clearActiveChatState();
    }
  }

  function handleRequestActiveChatDelete() {
    setIsChatMoreMenuOpen(false);
    setIsDeleteChatModalOpen(true);
  }

  function handleCancelActiveChatDelete() {
    setIsDeleteChatModalOpen(false);
  }

  function handleConfirmActiveChatDelete() {
    if (chatId) {
      deleteChatSession(chatId);
    }

    setIsDeleteChatModalOpen(false);
    resetChatUrl();
    setRoute("chat");
    clearActiveChatState();
    setShowDeleteToast(true);
  }

  async function handleSaveEdit(index: number) {
    const cleanDraft = editingDraft.trim();
    const messageToEdit = messages[index];

    if (
      !cleanDraft ||
      isLoading ||
      editingMessageIndex !== index ||
      !messageToEdit ||
      messageToEdit.role !== "user"
    ) {
      return;
    }

    const editedUserMessage: ChatMessage = {
      ...messageToEdit,
      content: cleanDraft,
    };
    const conversationBeforeEdit = messages.slice(0, index);
    const updatedConversation = [...conversationBeforeEdit, editedUserMessage];

    setMessages(updatedConversation);
    setEditingMessageIndex(null);
    setEditingDraft("");
    setError("");
    setIsLoading(true);

    if (index === 0 && !hasCustomTitleRef.current) {
      setChatTitle(createChatTitle(cleanDraft));
    }

    try {
      const responseModelId = currentModelId;
      const responseModelName = getModelName(responseModelId) ?? responseModelId;
      const assistantResponse = await sendChatMessage(updatedConversation, {
        modelId: responseModelId,
        webSearchEnabled: isWebSearchMode,
      });
      const assistantMessage = createAssistantMessage(
        assistantResponse.content,
        responseModelId,
        responseModelName,
        assistantResponse.tokens,
        assistantResponse.sources,
      );

      setMessages([...updatedConversation, assistantMessage]);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  function handlePromptClick(prompt: string) {
    void sendMessage(prompt);
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(input);
    }
  }

  function handleModelSelectorToggle() {
    setIsAttachmentMenuOpen(false);
    setIsModelSelectorOpen((currentState) => !currentState);
  }

  function handleModelSelect(nextModelId: string) {
    applyCurrentModelId(nextModelId);
    setIsModelSelectorOpen(false);
  }

  function getAttachmentMenuItemState(
    action: AttachmentMenuItem["action"],
  ): AttachmentMenuItemState {
    if (action === "file") {
      return {
        disabled: true,
        title: fileUploadUnsupportedMessage,
        active: false,
      };
    }

    if (action === "image" && !canUseImageInput) {
      return {
        disabled: true,
        title: "Switch to Llama 4 Scout to use image input",
        active: false,
      };
    }

    if (action === "web" && isMovieBotMode) {
      return {
        disabled: true,
        title: movieBotWebSearchWarningMessage,
        active: false,
        subtitle: movieBotWebSearchWarningMessage,
      };
    }

    if (action === "web" && !canUseWebSearch) {
      return {
        disabled: true,
        title: isCompoundModel(currentModelId)
          ? compoundWebSearchUnavailableMessage
          : "Switch to GPT OSS 120B for web search",
        active: false,
      };
    }

    if (action === "web") {
      return {
        disabled: false,
        title: isWebSearchMode
          ? "Web search is active"
          : "Turn on web search mode",
        active: isWebSearchMode,
        subtitle: undefined,
      };
    }

    return {
      disabled: false,
      title: undefined,
      active: false,
    };
  }

  function handleAttachmentItemClick(action: AttachmentMenuItem["action"]) {
    setIsAttachmentMenuOpen(false);

    if (action === "image") {
      if (!canUseImageInput) {
        return;
      }

      imageInputRef.current?.click();
      return;
    }

    if (action === "file") {
      return;
    }

    if (!canUseWebSearch) {
      return;
    }

    setIsWebSearchMode((currentState) => !currentState);
  }

  async function handleFileSelection(
    event: ChangeEvent<HTMLInputElement>,
    type: SelectedAttachment["type"],
  ) {
    const selectedFile = event.currentTarget.files?.[0];
    const fileInput = event.currentTarget;

    if (!selectedFile) {
      fileInput.value = "";
      return;
    }

    if (type === "image") {
      const mimeType = selectedFile.type;

      if (!canUseImageInput) {
        setError(
          "This model cannot process the selected image. Please switch to Llama 4 Scout.",
        );
        fileInput.value = "";
        return;
      }

      if (!isSupportedImageMimeType(mimeType)) {
        setError("Unsupported image type. Please choose a PNG, JPG, or WEBP image.");
        fileInput.value = "";
        return;
      }

      try {
        const dataUrl = await readImageAsDataUrl(selectedFile);

        if (!isValidImageDataUrl(dataUrl)) {
          setError("Selected image is not ready. Please choose the image again.");
          fileInput.value = "";
          return;
        }

        setSelectedAttachment({
          name: selectedFile.name,
          type,
          mimeType,
          dataUrl,
        });
        setError("");
      } catch (fileError) {
        setError(getErrorMessage(fileError));
      } finally {
        fileInput.value = "";
      }

      return;
    }

    setSelectedAttachment({
      name: selectedFile.name,
      type,
    });
    fileInput.value = "";
  }

  function handleStartRenamingTitle() {
    setDraftTitle(chatTitle);
    setIsRenamingTitle(true);
    setIsChatMoreMenuOpen(false);
  }

  function handleSaveTitle() {
    const cleanTitle = draftTitle.replace(/\s+/g, " ").trim();

    if (!cleanTitle) {
      return;
    }

    setChatTitle(cleanTitle);
    setDraftTitle(cleanTitle);
    setHasCustomTitle(true);
    hasCustomTitleRef.current = true;
    setIsRenamingTitle(false);
  }

  function handleCancelRename() {
    setDraftTitle(chatTitle);
    setIsRenamingTitle(false);
  }

  function handleRenameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      handleCancelRename();
    }
  }

  function handleCopyMessage(content: string) {
    if (!navigator.clipboard) {
      return;
    }

    void navigator.clipboard.writeText(content);
  }

  return (
    <div className={`chatbot-shell ${shellMode}`}>
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
            className={`sidebar-link ${
              route === "chat" && !hasMessages ? "active" : ""
            }`}
            onClick={handleNewChat}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              add_circle
            </span>
            New Chat
          </button>
          <button
            type="button"
            className={`sidebar-link ${isHistoryRoute ? "active" : ""}`}
            onClick={handleHistoryNavigation}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              history
            </span>
            History
          </button>
          <button
            type="button"
            className={`sidebar-link ${isLibraryRoute ? "active" : ""}`}
            onClick={handleLibraryNavigation}
          >
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

        <div className="sidebar-profile-wrap" ref={profileMenuRef}>
          {isProfileMenuOpen && (
            <div className="profile-menu" aria-label="Account menu">
              <div className="profile-menu-header">
                <div className="profile-avatar" aria-hidden="true">
                  MF
                </div>
                <div>
                  <p className="profile-name">Mohamad Fikri</p>
                  <p className="profile-type">Personal Account</p>
                </div>
              </div>

              <div className="profile-menu-section">
                <button type="button" className="profile-menu-item">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    tune
                  </span>
                  Personalization
                </button>
                <button type="button" className="profile-menu-item">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    account_circle
                  </span>
                  Profile
                </button>
                <button type="button" className="profile-menu-item">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    settings
                  </span>
                  Settings
                </button>
              </div>

              <div className="profile-menu-divider" />

              <button type="button" className="profile-menu-item with-arrow">
                <span className="material-symbols-outlined" aria-hidden="true">
                  help
                </span>
                Help
                <span className="material-symbols-outlined item-arrow" aria-hidden="true">
                  chevron_right
                </span>
              </button>

              <div className="profile-menu-divider" />

              <button
                type="button"
                className="profile-menu-item danger"
                onClick={onLogout}
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  logout
                </span>
                Sign Out
              </button>
            </div>
          )}

          <button
            type="button"
            className="sidebar-profile"
            aria-expanded={isProfileMenuOpen}
            onClick={() =>
              setIsProfileMenuOpen((currentState) => !currentState)
            }
          >
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
        </div>
      </aside>

      <main className={`chatbot-main ${shellMode}`}>
        {isHistoryRoute ? (
          <HistoryChat
            onDeleteChat={handleDeleteHistoryChat}
            onOpenChat={handleOpenHistoryChat}
            onOpenSidebar={() => setIsSidebarOpen(true)}
          />
        ) : isLibraryRoute ? (
          <Library onOpenSidebar={() => setIsSidebarOpen(true)} />
        ) : (
          <>
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
              {isRenamingTitle ? (
                <form
                  className="rename-title-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleSaveTitle();
                  }}
                >
                  <input
                    aria-label="Rename chat title"
                    autoFocus
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    onKeyDown={handleRenameKeyDown}
                  />
                  <button type="submit" className="save-title-button">
                    Save
                  </button>
                  <button
                    type="button"
                    className="cancel-title-button"
                    onClick={handleCancelRename}
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <h1 title={chatTitle}>{chatTitle}</h1>
              )}
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
              <div className="chat-more-menu" ref={chatMoreMenuRef}>
                <button
                  type="button"
                  aria-label="More chat options"
                  aria-expanded={isChatMoreMenuOpen}
                  onClick={() =>
                    setIsChatMoreMenuOpen((currentState) => !currentState)
                  }
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    more_vert
                  </span>
                </button>
                {isChatMoreMenuOpen && (
                  <div className="chat-more-dropdown">
                    <button type="button" onClick={handleStartRenamingTitle}>
                      <span
                        className="material-symbols-outlined"
                        aria-hidden="true"
                      >
                        edit
                      </span>
                      Rename title
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={handleRequestActiveChatDelete}
                    >
                      <span
                        className="material-symbols-outlined"
                        aria-hidden="true"
                      >
                        delete
                      </span>
                      Delete chat
                    </button>
                  </div>
                )}
              </div>
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
                <h2>Welcome to {chatbotConfig.botName}</h2>
                <p>{chatbotConfig.welcomeMessage}</p>
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
                <span>{formatDividerTime(getMessageDate(messages[0]))}</span>
              </div>

              {messages.map((message, index) => (
                <article
                  className={`message-row ${message.role}`}
                  key={`${message.role}-${index}`}
                >
                  <div className="message-stack">
                    {message.role === "assistant" ? (
                      <AssistantMessageContent message={message} />
                    ) : editingMessageIndex === index ? (
                      <div className="message-bubble is-editing">
                        <textarea
                          aria-label="Edit message"
                          autoFocus
                          className="message-edit-textarea"
                          value={editingDraft}
                          onChange={(event) =>
                            setEditingDraft(event.target.value)
                          }
                        />
                      </div>
                    ) : (
                      <div className="message-bubble">
                        {message.content.split("\n").map((line, lineIndex) => (
                          <p key={`${index}-${lineIndex}`}>{line}</p>
                        ))}
                        {message.image && (
                          <MessageImageAttachment image={message.image} />
                        )}
                      </div>
                    )}
                    {message.role === "assistant" ? (
                      <>
                        <div className="message-actions">
                          <button type="button" aria-label="Download response">
                            <span
                              className="material-symbols-outlined"
                              aria-hidden="true"
                            >
                              download
                            </span>
                          </button>
                          <button
                            type="button"
                            aria-label="Copy response"
                            onClick={() => handleCopyMessage(message.content)}
                          >
                            <span
                              className="material-symbols-outlined"
                              aria-hidden="true"
                            >
                              content_copy
                            </span>
                          </button>
                          <button
                            type="button"
                            aria-label="Regenerate response"
                            disabled={
                              isLoading || index !== latestAssistantMessageIndex
                            }
                            onClick={() => void handleRegenerate(index)}
                          >
                            <span
                              className="material-symbols-outlined"
                              aria-hidden="true"
                            >
                              refresh
                            </span>
                          </button>
                        </div>
                        <span className="message-time">
                          {formatMessageTime(getMessageDate(message))}
                          {typeof message.tokens === "number"
                            ? ` • ${message.tokens.toLocaleString()} tokens`
                            : ""}
                          {` • ${getMessageModelLabel(message, currentModelId)}`}
                        </span>
                      </>
                    ) : editingMessageIndex === index ? (
                      <div className="message-edit-actions">
                        <button
                          type="button"
                          className="cancel-edit-button"
                          onClick={handleCancelEdit}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="done-edit-button"
                          disabled={isLoading || !editingDraft.trim()}
                          onClick={() => void handleSaveEdit(index)}
                        >
                          Done
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="message-actions">
                          <button
                            type="button"
                            aria-label="Edit message"
                            disabled={
                              isLoading || editingMessageIndex !== null
                            }
                            onClick={() =>
                              handleStartEdit(index, message.content)
                            }
                          >
                            <span
                              className="material-symbols-outlined"
                              aria-hidden="true"
                            >
                              edit
                            </span>
                          </button>
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
                        <span className="message-time">
                          {formatMessageTime(getMessageDate(message))}
                        </span>
                      </>
                    )}
                  </div>
                </article>
              ))}

              {isLoading && (
                <div className="message-row assistant">
                  <div
                    className="typing-bubble"
                    aria-label={`${chatbotConfig.botName} is typing`}
                  >
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              )}

              {error && (
                <div className="chat-error" role="alert">
                  {error}
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </section>

        <form
          className="composer-wrap"
          onSubmit={handleSubmit}
          ref={composerWrapRef}
        >
          <input
            type="file"
            className="hidden-file-input"
            accept="image/png,image/jpeg,image/webp"
            ref={imageInputRef}
            onChange={(event) => handleFileSelection(event, "image")}
          />
          <div className="composer-model-row">
            <div
              className={`model-selector-control ${
                isModelSelectorOpen ? "is-open" : ""
              }`}
              ref={modelSelectorRef}
            >
              <button
                type="button"
                className="model-selector-trigger"
                aria-haspopup="listbox"
                aria-expanded={isModelSelectorOpen}
                aria-label={`Selected model: ${selectedModel.name}`}
                onClick={handleModelSelectorToggle}
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  memory
                </span>
                <span className="model-selector-label">Model</span>
                <span className="model-selector-selection">
                  <span className="model-selector-current">
                    {selectedModel.name}
                  </span>
                  <span
                    className="model-selector-selected-tags"
                    aria-label="Selected model capabilities"
                  >
                    {selectedModelCapabilityTags.map((tag) => (
                      <span className={getCapabilityTagClassName(tag)} key={tag}>
                        {tag}
                      </span>
                    ))}
                  </span>
                </span>
                <span
                  className="material-symbols-outlined model-selector-chevron"
                  aria-hidden="true"
                >
                  keyboard_arrow_down
                </span>
              </button>

              {isModelSelectorOpen && (
                <div
                  className="model-selector-menu"
                  role="listbox"
                  aria-label="Select chat model"
                >
                  {chatModelOptions.map((model) => {
                    const isSelected = model.id === currentModelId;

                    return (
                      <button
                        type="button"
                        className={`model-selector-option ${
                          isSelected ? "is-selected" : ""
                        }`}
                        role="option"
                        aria-selected={isSelected}
                        key={model.id}
                        onClick={() => handleModelSelect(model.id)}
                      >
                        <span className="model-selector-option-main">
                          <span className="model-selector-option-name">
                            {model.name}
                          </span>
                          <span className="model-selector-option-id">
                            {model.id}
                          </span>
                        </span>
                        <span
                          className="model-selector-option-tags"
                          aria-label={`${model.name} capabilities`}
                        >
                          {getModelCapabilityTags(model).map((tag) => (
                            <span
                              className={getCapabilityTagClassName(tag)}
                              key={tag}
                            >
                              {tag}
                            </span>
                          ))}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          {isCompoundModel(currentModelId) && (
            <div className="composer-model-note" role="status">
              <span className="material-symbols-outlined" aria-hidden="true">
                info
              </span>
              {compoundWebSearchUnavailableMessage}
            </div>
          )}
          {isMovieBotMode && isWebSearchMode && (
            <div className="composer-model-note" role="status">
              <span className="material-symbols-outlined" aria-hidden="true">
                info
              </span>
              {movieBotWebSearchWarningMessage}
            </div>
          )}
          {(selectedAttachment || isWebSearchMode) && (
            <div className="composer-chips" aria-label="Active input options">
              {selectedAttachment && (
                <span className="composer-chip">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    {selectedAttachment.type === "image"
                      ? "image"
                      : "description"}
                  </span>
                  <span className="composer-chip-text">
                    {selectedAttachment.name}
                  </span>
                  <button
                    type="button"
                    aria-label="Remove selected attachment"
                    onClick={() => setSelectedAttachment(null)}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      close
                    </span>
                  </button>
                </span>
              )}
              {isWebSearchMode && (
                <span className="composer-chip">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    language
                  </span>
                  <span className="composer-chip-text">Web Search</span>
                  <button
                    type="button"
                    aria-label="Turn off web search mode"
                    onClick={() => setIsWebSearchMode(false)}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      close
                    </span>
                  </button>
                </span>
              )}
            </div>
          )}
          <div className={`composer ${isTextareaExpanded ? "is-expanded" : ""}`}>
            {isAttachmentMenuOpen && (
              <div className="attachment-menu" aria-label="Attachment menu">
                {attachmentMenuItems.map((item) => {
                  const itemState = getAttachmentMenuItemState(item.action);

                  return (
                    <button
                      type="button"
                      className={`attachment-menu-item ${
                        itemState.disabled ? "is-disabled" : ""
                      } ${itemState.active ? "is-active" : ""}`}
                      disabled={itemState.disabled}
                      key={item.title}
                      title={itemState.title}
                      onClick={() => handleAttachmentItemClick(item.action)}
                    >
                      <span className="attachment-icon" aria-hidden="true">
                        <span className="material-symbols-outlined">
                          {item.icon}
                        </span>
                      </span>
                      <span className="attachment-text">
                        <span className="attachment-title">{item.title}</span>
                        <span className="attachment-subtitle">
                          {itemState.subtitle ?? item.subtitle}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <button
              type="button"
              className={`tool-button ${isAttachmentMenuOpen ? "is-active" : ""}`}
              aria-label="Attachment options"
              aria-expanded={isAttachmentMenuOpen}
              onClick={() =>
                setIsAttachmentMenuOpen((currentState) => !currentState)
              }
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                add
              </span>
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={`Message ${chatbotConfig.botName}...`}
              rows={1}
              disabled={isLoading}
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
          </div>
          <p className="composer-disclaimer">
            {chatbotConfig.botName} can make mistakes. Consider verifying important
            information.
          </p>
        </form>
          </>
        )}
      </main>

      {isDeleteChatModalOpen && (
        <DeleteChatModal
          chatTitle={chatTitle}
          onCancel={handleCancelActiveChatDelete}
          onConfirm={handleConfirmActiveChatDelete}
        />
      )}

      {showDeleteToast && <DynamicIslandToast />}
    </div>
  );
}

export default Chatbot;
