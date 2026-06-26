import { useState } from "react";
import { API_BASE_URL, NGROK_HEADERS } from "@/services/sscApi";
import { Loader2, Search, Play, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
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
    <div className="flex flex-col h-full space-y-6">
      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <Search className="w-5 h-5 text-red-600" />
          RAG Query Tester
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Uji query ke algoritma Retrieval-Augmented Generation (RAG) untuk melihat chunk data apa saja yang akan diambil bot berdasarkan Cosine Similarity dan Lexical Bonus (tanpa menggunakan token API Groq).
        </p>
        
        <form onSubmit={handleTestQuery} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Pertanyaan (Query)</label>
            <Input
              placeholder="Contoh: apa syarat pendaftaran yudisium?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full"
              required
            />
          </div>
          <div className="w-full sm:w-32">
            <label className="block text-sm font-medium text-gray-700 mb-1">Top-K</label>
            <Input
              type="number"
              min={1}
              max={20}
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              className="w-full"
              required
            />
          </div>
          <div className="flex items-end">
            <button 
              type="submit"
              disabled={isLoading || !query.trim()}
              className="h-10 px-6 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Test Query
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl border shadow-sm flex-1 flex flex-col overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 h-full">
            <Loader2 className="w-8 h-8 animate-spin text-red-600 mb-4" />
            <p className="text-sm text-gray-500 font-medium">Mencari dokumen (vector search)...</p>
          </div>
        ) : errorMsg ? (
          <div className="flex flex-col items-center justify-center p-12 h-full text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <p className="text-red-600 font-medium">{errorMsg}</p>
          </div>
        ) : !hasSearched ? (
          <div className="flex flex-col items-center justify-center p-12 h-full text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Belum Ada Pencarian</h3>
            <p className="text-gray-500">Masukkan pertanyaan dan tekan Test Query untuk melihat hasil.</p>
          </div>
        ) : matches.length === 0 ? (
          <div className="p-12 text-center h-full flex flex-col items-center justify-center">
            <p className="text-gray-500 font-medium">Tidak ada chunk yang memenuhi batas (threshold) similarity score.</p>
          </div>
        ) : (
          <div className="overflow-y-auto p-4 space-y-4 bg-gray-50 h-full">
            <div className="text-sm font-medium text-gray-700 px-2 py-1">
              Ditemukan {matches.length} chunk teratas:
            </div>
            {matches.map((match, idx) => {
              const isExpanded = expandedChunks[idx];
              return (
                <div key={idx} className="bg-white rounded-lg border shadow-sm p-4 hover:border-gray-300 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-900 text-white text-xs font-bold">
                        #{idx + 1}
                      </span>
                      <span className="font-semibold text-gray-900">{match.documentTitle}</span>
                      <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded">
                        Chunk {match.chunkIndex}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {match.sourceUrl && (
                        <a href={match.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline max-w-[150px] truncate" title={match.sourceUrl}>
                          {match.sourceUrl}
                        </a>
                      )}
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold ${match.score >= 0.18 ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                        Score: {match.score.toFixed(4)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-800 bg-gray-50 p-3 rounded border border-gray-100 font-serif leading-relaxed whitespace-pre-wrap">
                    {isExpanded ? match.text : `${match.text.substring(0, 250)}${match.text.length > 250 ? '...' : ''}`}
                  </div>
                  
                  {match.text.length > 250 && (
                    <button
                      onClick={() => toggleExpand(idx)}
                      className="mt-2 flex items-center text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
                    >
                      {isExpanded ? (
                        <><ChevronUp className="w-4 h-4 mr-1" /> Sembunyikan</>
                      ) : (
                        <><ChevronDown className="w-4 h-4 mr-1" /> Tampilkan semua</>
                      )}
                    </button>
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
