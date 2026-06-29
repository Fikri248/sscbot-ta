import { FileText, FileType, Clock, RefreshCcw, CheckCircle2 } from "lucide-react"
import { useState, useEffect } from "react"
import { API_BASE_URL, NGROK_HEADERS } from "@/services/sscApi"

export function Overview() {
  const [stats, setStats] = useState({
    totalDatasets: 0,
    pdfCount: 0,
    docxCount: 0,
    txtCount: 0,
    xlsxCount: 0,
    latestDocument: "",
    lastUpload: null
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
    const interval = setInterval(fetchOverviewData, 5000);
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
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Ringkasan Dokumen</h2>
        <p className="text-muted-foreground mt-1">Ringkasan status basis informasi yang digunakan oleh chatbot SSC.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Total Dokumen Card */}
        <div className="min-w-0 rounded-2xl border bg-card p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-muted-foreground">Total Dokumen</p>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-3xl font-bold text-foreground">{stats.totalDatasets}</div>
            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400">
              Dokumen aktif
            </span>
          </div>
        </div>

        {/* Distribusi File Card */}
        <div className="min-w-0 rounded-2xl border bg-card p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-muted-foreground">Distribusi File</p>
            <FileType className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm font-medium w-full mt-auto">
            <div className="flex justify-between"><span>PDF:</span> <span className="text-primary">{stats.pdfCount}</span></div>
            <div className="flex justify-between"><span>DOCX:</span> <span className="text-primary">{stats.docxCount}</span></div>
            <div className="flex justify-between"><span>TXT:</span> <span className="text-primary">{stats.txtCount}</span></div>
            <div className="flex justify-between"><span>XLSX:</span> <span className="text-primary">{stats.xlsxCount}</span></div>
          </div>
        </div>

        {/* Dokumen Terakhir Diunggah Card */}
        <div className="min-w-0 rounded-2xl border bg-card p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-muted-foreground">Dokumen Terakhir Diunggah</p>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </div>
          <p
            className="max-w-full break-words text-lg font-bold leading-snug text-foreground line-clamp-2"
            title={stats.latestDocument || "Belum ada dokumen"}
          >
            {stats.latestDocument || "Belum ada dokumen"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {stats.lastUpload ? `Diperbarui: ${formatDate(stats.lastUpload)}` : "Belum ada dokumen"}
          </p>
        </div>

        {/* Status Sinkronisasi Card */}
        <div className="min-w-0 rounded-2xl border bg-card p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-muted-foreground">Status Sinkronisasi</p>
            <RefreshCcw className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold text-foreground">
            {sync.isSyncing ? "Proses..." : "Tersinkron"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Terakhir diperbarui: {sync.lastSyncAt ? formatDate(sync.lastSyncAt) : "-"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-card rounded-xl border shadow-sm p-6 space-y-4">
          <h3 className="text-lg font-bold">Status Sistem dan Data</h3>
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-full ${sync.isSyncing ? 'bg-amber-100 text-amber-600 animate-pulse' : 'bg-green-100 text-green-600'}`}>
              <RefreshCcw className={`w-8 h-8 ${sync.isSyncing ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{sync.isSyncing ? "Sedang menyinkronkan data..." : "Sistem Siap"}</p>
              <p className="text-sm text-gray-500">{sync.isSyncing ? "Sistem sedang memproses dokumen terbaru." : "Data sudah tersimpan dan siap digunakan chatbot."}</p>
              <p className="text-xs text-gray-400 mt-1">Sinkronisasi terakhir: {formatDate(sync.lastSyncAt)}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-card rounded-xl border shadow-sm p-6 space-y-4">
          <h3 className="text-lg font-bold">Informasi Singkat Sistem</h3>
          <ul className="space-y-3 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              <span>Semua dokumen yang diunggah akan otomatis dipotong menjadi bagian-bagian informasi kecil untuk memudahkan pencarian chatbot.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              <span>Dokumen yang dihapus otomatis tidak akan digunakan lagi sebagai jawaban chatbot.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              <span>Tombol sinkronisasi memastikan data terbaru selalu digunakan secara akurat.</span>
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
