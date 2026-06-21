import { useState, useEffect } from "react"
import { Trash2, FileText, Loader2, RefreshCcw, Database, RotateCw } from "lucide-react"

type DocumentItem = {
  id: string
  title: string
  fileName: string
  mimetype: string
  chunkCount: number
  textLength: number
  updatedAt: string
}

type SyncStatus = {
  isSyncing: boolean
  lastSyncAt: string | null
  message: string
  totalDocuments: number
  totalChunks: number
}

export function KnowledgeBase() {
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)

  const fetchDocuments = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("http://localhost:5000/api/admin/datasets")
      const result = await response.json()

      if (result.status === "success") {
        setDocuments(result.data)
      }
    } catch (error) {
      console.error("Failed to fetch datasets:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchSyncStatus = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/admin/sync/status")
      const result = await response.json()

      if (result.status === "success") {
        setSyncStatus(result.data)
      }
    } catch (error) {
      console.error("Failed to fetch sync status:", error)
    }
  }

  const handleSync = async () => {
    if (!window.confirm("Jalankan sinkronisasi knowledge base sekarang?")) return

    setIsSyncing(true)
    try {
      const response = await fetch("http://localhost:5000/api/admin/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      })

      const result = await response.json()

      if (result.status === "success") {
        alert("Sinkronisasi knowledge base berhasil.")
        await fetchDocuments()
        await fetchSyncStatus()
      } else {
        alert("Sinkronisasi gagal: " + result.message)
      }
    } catch (error) {
      console.error("Sync error:", error)
      alert("Terjadi kesalahan saat sinkronisasi.")
    } finally {
      setIsSyncing(false)
    }
  }

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Yakin ingin menghapus dataset "${title}"?`)) return

    try {
      const response = await fetch(`http://localhost:5000/api/admin/datasets/${id}`, {
        method: "DELETE",
      })

      const result = await response.json()

      if (result.status === "success") {
        alert("Dataset berhasil dihapus.")
        await fetchDocuments()
        await fetchSyncStatus()
      } else {
        alert("Gagal menghapus: " + result.message)
      }
    } catch (error) {
      console.error("Delete error:", error)
      alert("Terjadi kesalahan saat menghapus dataset.")
    }
  }

  useEffect(() => {
    fetchDocuments()
    fetchSyncStatus()
  }, [])

  return (
    <div className="flex flex-col h-full bg-card rounded-xl border shadow-sm">
      <div className="p-6 border-b flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Knowledge Base</h2>
          <p className="text-sm text-muted-foreground">
            Kelola dataset, chunk, dan sinkronisasi knowledge base chatbot.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              fetchDocuments()
              fetchSyncStatus()
            }}
            className="p-2 border rounded-md hover:bg-muted transition flex items-center justify-center text-muted-foreground"
            title="Refresh Daftar"
          >
            <RefreshCcw className="w-5 h-5" />
          </button>

          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition disabled:opacity-50"
          >
            {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
            {isSyncing ? "Sinkronisasi..." : "Sync Knowledge Base"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 border-b">
        <div className="rounded-lg border p-4 bg-muted/20">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Database className="w-4 h-4" />
            Total Dataset
          </div>
          <p className="text-2xl font-bold mt-2">{documents.length}</p>
        </div>

        <div className="rounded-lg border p-4 bg-muted/20">
          <div className="text-sm text-muted-foreground">Total Chunks</div>
          <p className="text-2xl font-bold mt-2">
            {syncStatus?.totalChunks ?? documents.reduce((total, doc) => total + doc.chunkCount, 0)}
          </p>
        </div>

        <div className="rounded-lg border p-4 bg-muted/20">
          <div className="text-sm text-muted-foreground">Status Sync</div>
          <p className="text-sm font-medium mt-2">
            {syncStatus?.message || "Belum ada status"}
          </p>
        </div>

        <div className="rounded-lg border p-4 bg-muted/20">
          <div className="text-sm text-muted-foreground">Terakhir Sync</div>
          <p className="text-sm font-medium mt-2">
            {syncStatus?.lastSyncAt
              ? new Date(syncStatus.lastSyncAt).toLocaleString("id-ID")
              : "-"}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/50 sticky top-0">
            <tr>
              <th className="px-6 py-4 font-medium">Judul Dataset</th>
              <th className="px-6 py-4 font-medium">Nama File</th>
              <th className="px-6 py-4 font-medium">Tipe</th>
              <th className="px-6 py-4 font-medium">Chunks</th>
              <th className="px-6 py-4 font-medium">Panjang Teks</th>
              <th className="px-6 py-4 font-medium">Terakhir Update</th>
              <th className="px-6 py-4 font-medium text-right">Aksi</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <p>Memuat dataset knowledge base...</p>
                  </div>
                </td>
              </tr>
            ) : documents.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <FileText className="w-12 h-12 text-muted-foreground/30" />
                    <p>Belum ada dataset di knowledge base.</p>
                  </div>
                </td>
              </tr>
            ) : (
              documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4 font-medium flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary/70" />
                    {doc.title}
                  </td>

                  <td className="px-6 py-4 text-muted-foreground max-w-[260px] truncate">
                    {doc.fileName}
                  </td>

                  <td className="px-6 py-4 text-muted-foreground">
                    {doc.mimetype.includes("pdf")
                      ? "PDF"
                      : doc.mimetype.includes("word")
                      ? "DOCX"
                      : doc.mimetype.includes("sheet")
                      ? "XLSX"
                      : "TXT"}
                  </td>

                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                      {doc.chunkCount} chunks
                    </span>
                  </td>

                  <td className="px-6 py-4 text-muted-foreground">
                    {doc.textLength?.toLocaleString("id-ID") || 0}
                  </td>

                  <td className="px-6 py-4 text-muted-foreground">
                    {doc.updatedAt
                      ? new Date(doc.updatedAt).toLocaleDateString("id-ID", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : "-"}
                  </td>

                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDelete(doc.id, doc.title)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-md transition"
                      title="Hapus Dataset"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}