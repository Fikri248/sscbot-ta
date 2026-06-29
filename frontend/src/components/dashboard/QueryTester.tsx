import { useState } from "react";
import { API_BASE_URL, NGROK_HEADERS } from "@/services/sscApi";
import { Loader2, Search, Play, ChevronDown, ChevronUp, AlertCircle, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";

type Match = {
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  score: number;
  text: string;
  sourceUrl?: string;
};

export function QueryTester() {
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(5);
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [expandedChunks, setExpandedChunks] = useState<Record<number, boolean>>({});

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
    ...NGROK_HEADERS,
    "Content-Type": "application/json",
  });

  const handleTestQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setHasSearched(true);
    setErrorMsg("");
    setExpandedChunks({});

    try {
      const response = await fetch(`${API_BASE_URL}/admin/rag/query-test`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ query, topK }),
      });

      const result = await response.json();
      if (result.success || result.status === "success") {
        setMatches(result.matches || []);
      } else {
        setErrorMsg(result.message || "Gagal melakukan pencarian");
      }
    } catch (error) {
      console.error("Test query error:", error);
      setErrorMsg("Terjadi kesalahan jaringan atau server error.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = (index: number) => {
    setExpandedChunks(prev => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-card p-6 rounded-xl border shadow-sm shrink-0">
        <h2 className="text-2xl font-bold tracking-tight text-foreground mb-2 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          Uji Pertanyaan (Query Tester)
        </h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-3xl">
          Gunakan fitur ini untuk melihat potongan informasi apa saja yang akan ditemukan oleh sistem ketika pengguna menanyakan sesuatu. Ini membantu Anda memverifikasi apakah bot bisa menemukan jawaban yang tepat dari dokumen yang ada.
        </p>
        
        <form onSubmit={handleTestQuery} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-foreground mb-1">Pertanyaan Simulasi</label>
            <Input
              placeholder="Contoh: Apa syarat pendaftaran yudisium?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-background"
              required
            />
          </div>
          <div className="w-full sm:w-32">
            <label className="block text-sm font-medium text-foreground mb-1">Jumlah Hasil</label>
            <Input
              type="number"
              min={1}
              max={20}
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              className="w-full bg-background"
              required
            />
          </div>
          <div className="flex items-end">
            <button 
              type="submit"
              disabled={isLoading || !query.trim()}
              className="h-10 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Uji Sekarang
            </button>
          </div>
        </form>
      </div>

      <div className="bg-card rounded-xl border shadow-sm flex-1 flex flex-col overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 h-full">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground font-medium">Mencari informasi yang relevan...</p>
          </div>
        ) : errorMsg ? (
          <div className="flex flex-col items-center justify-center p-12 h-full text-center bg-destructive/5">
            <AlertCircle className="w-12 h-12 text-destructive mb-4" />
            <p className="text-destructive font-medium">{errorMsg}</p>
          </div>
        ) : !hasSearched ? (
          <div className="flex flex-col items-center justify-center p-12 h-full text-center">
            <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">Belum Ada Pencarian</h3>
            <p className="text-sm text-muted-foreground max-w-sm">Masukkan pertanyaan di atas dan klik "Uji Sekarang" untuk melihat potongan data mana yang paling cocok dengan pertanyaan Anda.</p>
          </div>
        ) : matches.length === 0 ? (
          <div className="p-12 text-center h-full flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground font-medium text-lg">Tidak ada informasi yang ditemukan.</p>
            <p className="text-sm text-muted-foreground mt-1">Coba gunakan kata kunci lain atau unggah dokumen yang relevan.</p>
          </div>
        ) : (
          <div className="overflow-y-auto p-4 md:p-6 space-y-4 bg-muted/10 h-full">
            <div className="text-sm font-medium text-muted-foreground mb-2 flex items-center justify-between">
              <span>Menampilkan {matches.length} hasil paling relevan:</span>
            </div>
            
            {matches.map((match, idx) => {
              const isExpanded = expandedChunks[idx];
              const scorePercent = (match.score * 100).toFixed(1);
              
              let scoreColor = "text-green-600 bg-green-50 border-green-200";
              if (match.score < 0.75) scoreColor = "text-amber-600 bg-amber-50 border-amber-200";
              if (match.score < 0.6) scoreColor = "text-red-600 bg-red-50 border-red-200";

              return (
                <div key={idx} className="bg-background rounded-xl border shadow-sm overflow-hidden transition-all hover:border-primary/30">
                  <div 
                    className="p-4 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30"
                    onClick={() => toggleExpand(idx)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold text-sm">
                        #{idx + 1}
                      </span>
                      <div>
                        <h4 className="font-bold text-foreground line-clamp-1">{match.documentTitle}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded">
                            Potongan {match.chunkIndex}
                          </span>
                          {match.sourceUrl && (
                            <span className="text-xs text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded px-1 truncate max-w-[150px]">
                              {match.sourceUrl}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 justify-between sm:justify-end">
                      <div className="flex flex-col items-end">
                        <span className="text-xs text-muted-foreground mb-0.5">Tingkat Kecocokan</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${scoreColor}`}>
                          {scorePercent}%
                        </span>
                      </div>
                      <div className="p-1 rounded-md hover:bg-muted">
                        {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                      </div>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="p-5 border-t border-border bg-muted/5">
                      <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Isi Potongan Data:</h5>
                      <div className="p-4 bg-background border rounded-lg text-sm text-foreground whitespace-pre-wrap font-mono leading-relaxed shadow-inner">
                        {match.text}
                      </div>
                      <div className="mt-3 flex justify-end">
                        <p className="text-xs text-muted-foreground italic">
                          Teks inilah yang akan diberikan kepada AI untuk merangkai jawaban akhir.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
