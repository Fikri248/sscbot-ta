import fs from "fs";
import path from "path";

export const TUGAS_AKHIR_PORTAL_URL = "https://ssc.telu-sby.id/portal-informasi/tugas-akhir";

let cachedLinks: { label: string; url: string }[] | null = null;

function addUniqueLink(label: string, url: string) {
  if (!cachedLinks) cachedLinks = [];
  const exists = cachedLinks.some((item) => item.label === label || item.url === url);
  if (!exists) cachedLinks.push({ label, url });
}

function loadLinks() {
  if (cachedLinks !== null) return;

  cachedLinks = [];

  // Link utama portal informasi tugas akhir SSC. Link ini dipakai saat user meminta link/dokumen Tugas Akhir secara umum.
  addUniqueLink("Portal Informasi Tugas Akhir SSC Telkom University Surabaya", TUGAS_AKHIR_PORTAL_URL);
  addUniqueLink("Portal Tugas Akhir", TUGAS_AKHIR_PORTAL_URL);
  addUniqueLink("Informasi Tugas Akhir", TUGAS_AKHIR_PORTAL_URL);

  try {
    const filePath = path.join(process.cwd(), "dataset", "Kumpulan_Link_Penting_SSC.txt");
    if (!fs.existsSync(filePath)) return;

    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.match(/^\d+\.\s+Link\s+/)) {
        const label = line.replace(/^\d+\.\s+Link\s+/, "").trim();
        const nextLine = lines[i + 1] ? lines[i + 1].trim() : "";
        const urlMatch = nextLine.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) addUniqueLink(label, urlMatch[1]);
      }
    }
  } catch (error) {
    console.error("Error loading links file:", error);
  }
}

function normalizeStr(str: string) {
  return str
    .replace(/\.(pdf|docx|doc|xlsx|xls|txt|md|csv)$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function isTugasAkhirPortalRequest(query: string): boolean {
  const q = query.toLowerCase();
  const asksPortalLink =
    q.includes("link") ||
    q.includes("tautan") ||
    q.includes("portal") ||
    q.includes("portal informasi");

  const mentionsTA =
    q.includes("tugas akhir") ||
    q.includes(" ta") ||
    q === "ta" ||
    q.includes("portal informasi tugas akhir") ||
    q.includes("informasi tugas akhir");

  return asksPortalLink && mentionsTA;
}

export function resolveOriginalSourceUrl(title: string, fallbackUrl?: string): string | null {
  loadLinks();

  if (!title) {
    if (fallbackUrl && fallbackUrl.startsWith("http")) return fallbackUrl;
    return null;
  }

  const normTitle = normalizeStr(title);

  if (cachedLinks) {
    for (const item of cachedLinks) {
      const normLabel = normalizeStr(item.label);
      if (normTitle.includes(normLabel) || normLabel.includes(normTitle)) {
        return item.url;
      }
    }
  }

  if (
    normTitle.includes("tugasakhir") ||
    normTitle.includes("portalinformasi") ||
    normTitle === "ta"
  ) {
    return TUGAS_AKHIR_PORTAL_URL;
  }

  if (fallbackUrl && fallbackUrl.startsWith("http")) return fallbackUrl;

  return null;
}

export function findMatchingImportantLinks(query: string): { label: string; url: string }[] {
  loadLinks();
  if (!cachedLinks) return [];

  const rawQuery = query.toLowerCase().trim();

  if (isTugasAkhirPortalRequest(rawQuery)) {
    return [
      {
        label: "Portal Informasi Tugas Akhir SSC Telkom University Surabaya",
        url: TUGAS_AKHIR_PORTAL_URL,
      },
    ];
  }

  const exactGenericMatches = [
    "link ssc",
    "daftar link ssc",
    "tautan ssc",
    "semua link",
    "link",
    "tautan",
    "daftar tautan",
    "kumpulan link",
    "linktree",
    "kumpulan tautan",
  ];

  if (exactGenericMatches.some((g) => rawQuery === g || rawQuery === `mana ${g}`)) {
    return cachedLinks;
  }

  const stopwords = [
    "mana",
    "link",
    "tautan",
    "daftar",
    "apa",
    "itu",
    "yang",
    "dan",
    "untuk",
    "dari",
    "buat",
    "minta",
    "berikan",
    "dokumen",
    "file",
    "sumber",
  ];

  const queryTokens = query
    .toLowerCase()
    .split(/[\s_\-\.\?]+/)
    .filter((t) => t.length > 1 && !stopwords.includes(t));

  if (queryTokens.length === 0) return cachedLinks;

  const scoredMatches = cachedLinks
    .map((item) => {
      const normLabel = item.label.toLowerCase();
      let score = 0;

      for (const token of queryTokens) {
        if (token === "ta") {
          if (normLabel.includes("tugas akhir") || /\bta\b/.test(normLabel)) score++;
        } else if (normLabel.includes(token)) {
          score++;
        }
      }

      return { item, score };
    })
    .filter((m) => m.score > 0);

  if (scoredMatches.length > 0) {
    const maxScore = Math.max(...scoredMatches.map((m) => m.score));
    const requiredScore = Math.min(2, queryTokens.length);
    if (maxScore >= requiredScore) {
      return scoredMatches.filter((m) => m.score === maxScore).map((m) => m.item);
    }
  }

  return cachedLinks;
}
