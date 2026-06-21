export function normalizeQuery(rawText: string): string {
  if (!rawText) return "";

  let normalized = rawText.toLowerCase().replace(/\s+/g, " ").trim();

  // 1. Dictionary-based abbreviation expansion
  const dictionary: Record<string, string> = {
    "mhs": "mahasiswa",
    "mhss": "mahasiswa",
    "mahaswa": "mahasiswa",
    "surt": "surat",
    "suratn": "surat",
    "aktf": "aktif",
    "aktifitas": "aktivitas",
    "ta": "tugas akhir",
    "tugas ahir": "tugas akhir",
    "sidng": "sidang",
    "sidang ta": "sidang tugas akhir",
    "toss": "TOSS",
    "tempalte": "template",
    "templte": "template",
    "pedomn": "pedoman",
    "pedoman ta": "pedoman tugas akhir",
    "cumlaud": "cumlaude",
    "cum laude": "cumlaude",
    "dospem": "dosen pembimbing",
    "pemb": "pembimbing",
    "pembimbing 1": "pembimbing satu",
    "pembimbing 2": "pembimbing dua",
    "dosji": "dosen penguji",
    "pengjii": "penguji",
    "penguji 1": "penguji satu",
    "penguji 2": "penguji dua",
    "ttd": "tanda tangan",
    "gmn": "bagaimana",
    "gmna": "bagaimana",
    "gimana": "bagaimana",
    "urus": "mengurus",
    "daftar": "pendaftaran",
    "pengajuan": "pengajuan",
    "pembmbng": "pembimbing"
  };

  // Replace strict phrases first (multi-word)
  const multiWordKeys = Object.keys(dictionary).filter((k) => k.includes(" ")).sort((a, b) => b.length - a.length);
  for (const key of multiWordKeys) {
    const regex = new RegExp(`\\b${key}\\b`, "g");
    normalized = normalized.replace(regex, dictionary[key]);
  }

  // Replace single words
  const words = normalized.split(" ");
  const processedWords = words.map((word) => {
    if (dictionary[word]) {
      return dictionary[word];
    }
    return word;
  });

  // 2. Strict fuzzy correction (Levenshtein)
  const controlledVocabulary = [
    "surat", "aktif", "mahasiswa", "sidang", "tugas", "akhir",
    "template", "pedoman", "cumlaude", "pembimbing", "penguji",
    "kelulusan", "pendaftaran", "persyaratan", "pengajuan", "toss",
    "sk", "dokumen", "link", "tautan", "sumber", "akademik", "layanan", "ssc"
  ];

  const fuzzyWords = processedWords.map((word) => {
    if (word.length >= 4) {
      for (const vocab of controlledVocabulary) {
        if (levenshtein(word, vocab) <= 1) {
          return vocab;
        }
      }
    }
    return word;
  });

  const finalNormalized = fuzzyWords.join(" ");

  // 3. Semantic expansion for specific short queries
  if (finalNormalized === "penguji tugas akhir") {
    return "syarat penguji 1 dan penguji 2 tugas akhir persyaratan pembimbing dan penguji tugas akhir";
  }

  return finalNormalized;
}

// Lightweight Levenshtein distance implementation
function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1,   // insertion
            matrix[i - 1][j] + 1    // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
