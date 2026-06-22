import fs from "fs";
import path from "path";

let cachedLinks: { label: string, url: string }[] | null = null;

function loadLinks() {
  if (cachedLinks !== null) return;
  cachedLinks = [];
  try {
    const filePath = path.join(__dirname, "../../dataset/Kumpulan_Link_Penting_SSC.txt");
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.match(/^\d+\.\s+Link\s+/)) {
        const label = line.replace(/^\d+\.\s+Link\s+/, "").trim();
        const nextLine = lines[i+1] ? lines[i+1].trim() : "";
        const urlMatch = nextLine.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) {
          cachedLinks.push({
            label: label,
            url: urlMatch[1]
          });
        }
      }
    }
  } catch(e) {
    console.error("Error loading links file:", e);
  }
}

function normalizeStr(str: string) {
  let s = str.replace(/\.(pdf|docx|txt|md|csv)$/i, "");
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
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

  if (fallbackUrl && fallbackUrl.startsWith("http")) return fallbackUrl;
  
  return null;
}

export function findMatchingImportantLinks(query: string): { label: string, url: string }[] {
  loadLinks();
  if (!cachedLinks) return [];
  
  const rawQuery = query.toLowerCase().trim();
  const exactGenericMatches = ["link ssc", "daftar link ssc", "tautan ssc", "semua link", "link", "tautan", "daftar tautan", "kumpulan link", "linktree", "kumpulan tautan"];
  if (exactGenericMatches.some(g => rawQuery === g || rawQuery === `mana ${g}`)) {
    return cachedLinks;
  }

  const queryTokens = query.toLowerCase().split(/[\s_\-\.\?]+/).filter(t => t.length > 1 && !["mana", "link", "tautan", "daftar", "apa", "itu", "yang", "dan", "untuk", "dari", "buat"].includes(t));
  
  if (queryTokens.length === 0) {
    return cachedLinks;
  }

  const scoredMatches = cachedLinks.map(item => {
    const normLabel = item.label.toLowerCase();
    let score = 0;
    // Special handling for TA
    for (const token of queryTokens) {
      if (token === "ta") {
         if (normLabel.includes("tugas akhir") || /\bta\b/.test(normLabel)) score++;
      } else {
         if (normLabel.includes(token)) score++;
      }
    }
    return { item, score };
  }).filter(m => m.score > 0);
  
  if (scoredMatches.length > 0) {
    const maxScore = Math.max(...scoredMatches.map(m => m.score));
    const requiredScore = Math.min(2, queryTokens.length);
    if (maxScore >= requiredScore) {
      return scoredMatches.filter(m => m.score === maxScore).map(m => m.item);
    }
  }
  
  return cachedLinks;
}
