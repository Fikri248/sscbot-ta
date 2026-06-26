import { useState, useEffect } from "react";
import { API_BASE_URL, NGROK_HEADERS } from "@/services/sscApi";
import { Loader2, Search, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";

type Chunk = {
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  text: string;
  documentUrl?: string;
  sourceUrl?: string;
};

type DocumentItem = {
  id: string;
  title: string;
};

export function ChunksViewer() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedChunks, setExpandedChunks] = useState<Record<number, boolean>>({});

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
    ...NGROK_HEADERS,
  });

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/datasets`, { headers: authHeaders() });
      const result = await response.json();
      if (result.status === "success") {
        setDocuments(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    }
  };

  useEffect(() => {
    if (selectedDocId) {
      fetchChunks(selectedDocId);
    } else {
      setChunks([]);
    }
  }, [selectedDocId]);

  const fetchChunks = async (docId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/documents/${docId}/chunks`, { headers: authHeaders() });
      const result = await response.json();
      if (result.status === "success") {
        setChunks(result.data);
        setExpandedChunks({});
      }
    } catch (error) {
      console.error("Failed to fetch chunks:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = (index: number) => {
    setExpandedChunks(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const filteredChunks = chunks.filter(c => 
    c.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Database className="w-5 h-5 text-red-600" />
          Knowledge Base Chunks Viewer
        </h2>
        
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Dokumen</label>
            <select
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
            >
              <option value="">-- Pilih Dokumen --</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Cari Teks Chunk</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Ketik untuk mencari..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm flex-1 flex flex-col overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 h-full">
            <Loader2 className="w-8 h-8 animate-spin text-red-600 mb-4" />
            <p className="text-sm text-gray-500 font-medium">Memuat chunks...</p>
          </div>
        ) : !selectedDocId ? (
          <div className="flex flex-col items-center justify-center p-12 h-full text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Belum Ada Dokumen Terpilih</h3>
            <p className="text-gray-500">Pilih dokumen di atas untuk melihat potongan data (chunks).</p>
          </div>
        ) : filteredChunks.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500">Tidak ada chunk yang ditemukan.</p>
          </div>
        ) : (
          <div className="overflow-y-auto p-4 space-y-4 bg-gray-50 h-full">
            {filteredChunks.map((chunk, idx) => {
              const isExpanded = expandedChunks[idx];
              return (
                <div key={idx} className="bg-white rounded-lg border shadow-sm p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
                      Chunk #{chunk.chunkIndex}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(chunk.text);
                        alert("Text disalin!");
                      }}
                      className="text-xs text-blue-600 hover:underline font-medium"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="text-sm text-gray-800 bg-gray-50 p-3 rounded border font-mono whitespace-pre-wrap">
                    {isExpanded ? chunk.text : `${chunk.text.substring(0, 150)}${chunk.text.length > 150 ? '...' : ''}`}
                  </div>
                  {chunk.text.length > 150 && (
                    <button
                      onClick={() => toggleExpand(idx)}
                      className="mt-2 flex items-center text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
                    >
                      {isExpanded ? (
                        <><ChevronUp className="w-4 h-4 mr-1" /> Sembunyikan</>
                      ) : (
                        <><ChevronDown className="w-4 h-4 mr-1" /> Selengkapnya</>
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

const Database = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>
);
