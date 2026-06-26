import { useState, useEffect } from "react";
import { API_BASE_URL, NGROK_HEADERS } from "@/services/sscApi";
import { Loader2, Search, Globe, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";

type ScrapedItem = {
  url?: string;
  sourceUrl?: string;
  localUrl?: string;
  title?: string;
  text?: string;
  textLength: number;
  totalChunks: number;
  isLegacyCache?: boolean;
};

export function ScrapedDataViewer() {
  const [data, setData] = useState<ScrapedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
    ...NGROK_HEADERS,
  });

  useEffect(() => {
    fetchScrapedData();
  }, []);

  const fetchScrapedData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/scraped-data`, { headers: authHeaders() });
      const result = await response.json();
      if (result.status === "success") {
        setData(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch scraped data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredData = data.filter(item => 
    (item.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.url || item.sourceUrl || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <Globe className="w-5 h-5 text-red-600" />
          Scraped Data / Legacy Dataset Viewer
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Melihat data hasil scraping atau cache legacy yang belum/sudah disinkronisasi ke database utama.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Cari berdasarkan judul atau URL..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <button 
            onClick={fetchScrapedData}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md transition-colors"
          >
            Refresh Data
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 h-full">
            <Loader2 className="w-8 h-8 animate-spin text-red-600 mb-4" />
            <p className="text-sm text-gray-500 font-medium">Memuat data...</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="p-12 text-center h-full flex flex-col items-center justify-center">
            <FileText className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">Tidak ada data ditemukan.</p>
          </div>
        ) : (
          <div className="overflow-x-auto h-full">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-200">Judul</th>
                  <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-200">URL / Source URL</th>
                  <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-200">Ukuran Teks</th>
                  <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-200">Status Cache</th>
                  <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-200">Total Chunks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900 max-w-xs truncate" title={item.title || "Tanpa Judul"}>
                        {item.title || "Tanpa Judul"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-blue-600 max-w-xs truncate" title={item.url || item.sourceUrl || "-"}>
                        {item.url || item.sourceUrl ? (
                          <a href={item.url || item.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            {item.url || item.sourceUrl}
                          </a>
                        ) : "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">
                        {item.textLength.toLocaleString()} kar.
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {item.isLegacyCache ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Legacy JSON Cache
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Database
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {item.totalChunks}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
