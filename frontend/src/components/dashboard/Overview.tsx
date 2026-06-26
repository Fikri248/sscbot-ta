import { StatCard } from "./StatCard"
import { Database, FileText, CheckCircle2, RefreshCcw, FileType } from "lucide-react"
import { useState, useEffect } from "react"
import { API_BASE_URL, NGROK_HEADERS } from "@/services/sscApi"

export function Overview() {
  const [stats, setStats] = useState({
    totalDatasets: 0,
    totalChunks: 0
  });

  const [sync, setSync] = useState({
    isSyncing: false,
    lastSyncAt: null,
    message: "Belum ada informasi"
  });

  const authHeaders = { 
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
    ...NGROK_HEADERS
  };

  useEffect(() => {
    const fetchOverviewData = async () => {
      try {
        const statsRes = await fetch(`${API_BASE_URL}/admin/stats`, { headers: authHeaders });
        const statsData = await statsRes.json();
        if (statsData.status === "success") {
          setStats(statsData.data);
        }

        const syncRes = await fetch(`${API_BASE_URL}/admin/sync/status`, { headers: authHeaders });
        const syncData = await syncRes.json();
        if (syncData.status === "success") {
          setSync(syncData.data);
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchOverviewData();
    const interval = setInterval(fetchOverviewData, 5000); // Polling every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "Belum pernah";
    const date = new Date(dateString);
    return date.toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Knowledge Base Overview</h2>
        <p className="text-muted-foreground mt-1">Ringkasan status basis pengetahuan chatbot SSC.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Dokumen" 
          value={stats.totalDatasets.toString()} 
          delta="Terindeks" 
          deltaType="positive"
          icon={FileText}
        />
        <StatCard 
          title="Total Chunks" 
          value={stats.totalChunks.toString()} 
          delta="Potongan Data" 
          deltaType="positive"
          icon={Database}
        />
        <StatCard 
          title="Source of Truth" 
          value="MySQL" 
          delta="Aiven / Local" 
          deltaType="neutral"
          icon={CheckCircle2}
        />
        <StatCard 
          title="Tipe File Dukungan" 
          value="4 Tipe" 
          delta="PDF, DOCX, XLSX, TXT" 
          deltaType="neutral"
          icon={FileType}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border shadow-sm p-6 space-y-4">
          <h3 className="text-lg font-bold">Status Sinkronisasi</h3>
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-full ${sync.isSyncing ? 'bg-amber-100 text-amber-600 animate-pulse' : 'bg-green-100 text-green-600'}`}>
              <RefreshCcw className={`w-8 h-8 ${sync.isSyncing ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{sync.isSyncing ? "Sedang menyinkronkan..." : "Sistem Siap"}</p>
              <p className="text-sm text-gray-500">{sync.message}</p>
              <p className="text-xs text-gray-400 mt-1">Terakhir sync: {formatDate(sync.lastSyncAt)}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-card rounded-xl border shadow-sm p-6 space-y-4">
          <h3 className="text-lg font-bold">Informasi RAG (Retrieval)</h3>
          <ul className="space-y-3 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              <span>Dokumen yang dihapus otomatis disembunyikan dari hasil pencarian (Soft Delete).</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              <span>Cosine similarity threshold disesuaikan untuk presisi optimal.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              <span>Pencarian dilakukan di table <code className="bg-gray-100 px-1 rounded">document_chunks</code>.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              <span>JSON file hanya digunakan sebagai fallback darurat.</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-border text-center text-sm text-muted-foreground">
        SSC Dashboard Admin Console &middot; Telkom University &copy; 2026
      </div>
    </div>
  )
}
