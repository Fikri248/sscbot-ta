import React, { useState, useEffect, useRef } from "react"
import { Trash2, FileText, Loader2, RefreshCcw, Database, RotateCw, Upload, Edit3, Save, X, Eye } from "lucide-react"
import { API_BASE_URL, BACKEND_BASE_URL, NGROK_HEADERS } from "@/services/sscApi"

type DocumentItem = {
  id: string
  title: string
  fileName: string
  storedFileName?: string
  mimetype: string
  sourceUrl?: string | null
  localUrl?: string | null
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
  const [isUploading, setIsUploading] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [editingDoc, setEditingDoc] = useState<DocumentItem | null>(null)
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editSourceUrl, setEditSourceUrl] = useState("")
  const [editText, setEditText] = useState("")
  const [replacementFile, setReplacementFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const replaceFileInputRef = useRef<HTMLInputElement>(null)
  const authHeaders = () => ({ 
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
    ...NGROK_HEADERS
  })

  const fetchDocuments = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/admin/datasets`, { headers: authHeaders() })
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
      const response = await fetch(`${API_BASE_URL}/admin/sync/status`, { headers: authHeaders() })
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
      const response = await fetch(`${API_BASE_URL}/admin/sync`, {
        method: "POST",
        headers: {
          ...authHeaders(),
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

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    const formData = new FormData()
    formData.append("file", file)
    formData.append("title", file.name)

    try {
      const response = await fetch(`${API_BASE_URL}/documents/upload`, {
        method: "POST",
        headers: authHeaders(),
        body: formData,
      })
      const result = await response.json()
      if (result.success) {
        alert("Dokumen berhasil diunggah dan langsung masuk Aiven + document_chunks.")
        await fetchDocuments()
        await fetchSyncStatus()
      } else {
        alert("Gagal mengunggah: " + result.message)
      }
    } catch (error) {
      console.error("Upload error:", error)
      alert("Terjadi kesalahan saat mengunggah dokumen.")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleOpenEdit = (doc: DocumentItem) => {
    setEditingDoc(doc)
    setEditTitle(doc.title)
    setEditSourceUrl(doc.sourceUrl || "")
    setEditText("")
    setReplacementFile(null)
    if (replaceFileInputRef.current) {
      replaceFileInputRef.current.value = ""
    }
  }

  const handleCancelEdit = () => {
    setEditingDoc(null)
    setEditTitle("")
    setEditSourceUrl("")
    setEditText("")
    setReplacementFile(null)
    if (replaceFileInputRef.current) {
      replaceFileInputRef.current.value = ""
    }
  }

  const handleUpdate = async () => {
    if (!editingDoc) return
    if (!editTitle.trim()) {
      alert("Judul dataset tidak boleh kosong.")
      return
    }

    setIsUpdating(true)
    try {
      let response: Response

      if (replacementFile) {
        const formData = new FormData()
        formData.append("title", editTitle.trim())
        formData.append("sourceUrl", editSourceUrl.trim())
        formData.append("file", replacementFile)

        response = await fetch(`${API_BASE_URL}/documents/${editingDoc.id}`, {
          method: "PUT",
          headers: authHeaders(),
          body: formData,
        })
      } else {
        const payload: {
          title: string
          sourceUrl: string | null
          extractedText?: string
        } = {
          title: editTitle.trim(),
          sourceUrl: editSourceUrl.trim() || null,
        }

        if (editText.trim()) {
          payload.extractedText = editText.trim()
        }

        response = await fetch(`${API_BASE_URL}/admin/datasets/${editingDoc.id}`, {
          method: "PUT",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })
      }

      const result = await response.json()

      if (result.status === "success" || result.success) {
        alert(
          replacementFile
            ? "Dokumen berhasil diganti. File baru sudah diekstrak, chunk lama dihapus, chunk baru dibuat."
            : editText.trim()
            ? "Dataset berhasil diupdate. Chunk chatbot sudah diperbarui dari teks baru."
            : "Metadata dataset berhasil diperbarui."
        )
        handleCancelEdit()
        await fetchDocuments()
        await fetchSyncStatus()
      } else {
        alert("Gagal update dataset: " + result.message)
      }
    } catch (error) {
      console.error("Update error:", error)
      alert("Terjadi kesalahan saat update dataset.")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Yakin ingin menghapus dataset "${title}"?`)) return

    try {
      const response = await fetch(`${API_BASE_URL}/admin/datasets/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      })

      const result = await response.json()

      if (result.status === "success") {
        alert("Dataset berhasil dihapus dari Aiven, document_chunks, dan file fisik jika ada.")
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

  const getFileType = (mimetype: string, fileName?: string) => {
    const lowerName = (fileName || "").toLowerCase()
    if (mimetype.includes("pdf") || lowerName.endsWith(".pdf")) return "PDF"
    if (mimetype.includes("word") || lowerName.endsWith(".docx")) return "DOCX"
    if (mimetype.includes("sheet") || lowerName.endsWith(".xlsx")) return "XLSX"
    return "TXT"
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
            CRUD per dokumen PDF, DOCX, XLSX, dan TXT. Semua tersimpan ke Aiven dan dipakai chatbot.
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
            onClick={handleUploadClick}
            disabled={isUploading}
            className="flex items-center gap-2 px-4 py-2 border border-input bg-background rounded-md hover:bg-muted transition disabled:opacity-50 text-sm font-medium"
            title="Create / Upload Dokumen Baru"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {isUploading ? "Mengunggah..." : "Create / Upload"}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".pdf,.docx,.xlsx,.txt"
            onChange={handleFileChange}
          />

          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition disabled:opacity-50 text-sm font-medium"
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
            Total Dokumen
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

      {editingDoc && (
        <div className="p-6 border-b bg-muted/20">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <Edit3 className="w-4 h-4" />
                Update Dokumen
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Untuk mengubah isi dokumen PDF/DOCX/XLSX/TXT, pilih file pengganti. Sistem akan menghapus chunk lama dan membuat chunk baru.
              </p>
            </div>
            <button
              onClick={handleCancelEdit}
              className="p-2 rounded-md hover:bg-background transition"
              title="Batal Edit"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium">Judul Dokumen</label>
              <input
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
                className="mt-1 w-full px-3 py-2 border rounded-md bg-background"
                placeholder="Masukkan judul dokumen"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Source URL / Link Sumber</label>
              <input
                value={editSourceUrl}
                onChange={(event) => setEditSourceUrl(event.target.value)}
                className="mt-1 w-full px-3 py-2 border rounded-md bg-background"
                placeholder="Opsional, contoh: https://ssc.telu-sby.id/..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium">File Pengganti</label>
              <input
                ref={replaceFileInputRef}
                type="file"
                accept=".pdf,.docx,.xlsx,.txt"
                onChange={(event) => setReplacementFile(event.target.files?.[0] || null)}
                className="mt-1 w-full px-3 py-2 border rounded-md bg-background"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Pilih file hanya jika ingin mengganti isi dokumen dan chunk chatbot.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">File Saat Ini</label>
              <div className="mt-1 px-3 py-2 border rounded-md bg-background text-sm text-muted-foreground truncate">
                {editingDoc.fileName}
              </div>
              {replacementFile && (
                <p className="text-xs text-blue-600 mt-1">
                  File baru: {replacementFile.name}
                </p>
              )}
            </div>
          </div>

          <div className="mb-4">
            <label className="text-sm font-medium">Isi Teks Baru Manual</label>
            <textarea
              value={editText}
              onChange={(event) => setEditText(event.target.value)}
              rows={6}
              className="mt-1 w-full px-3 py-2 border rounded-md bg-background font-mono text-sm"
              placeholder="Opsional. Dipakai jika tidak mengganti file, tapi ingin update chunk lewat teks manual. Contoh untuk tes: TES UPDATE AIVEN 2026 adalah BIRU LANGIT."
            />
            <p className="text-xs text-muted-foreground mt-1">
              Jika file pengganti dipilih, sistem memakai isi file pengganti. Jika file tidak dipilih tapi teks ini diisi, sistem memakai teks manual ini.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={handleCancelEdit}
              disabled={isUpdating}
              className="px-4 py-2 border rounded-md hover:bg-background transition disabled:opacity-50"
            >
              Batal
            </button>
            <button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition disabled:opacity-50"
            >
              {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isUpdating ? "Menyimpan..." : "Simpan Update"}
            </button>
          </div>
        </div>
      )}

      {previewDoc && (
        <div className="p-6 border-b bg-background">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Detail Dokumen
              </h3>
              <div className="mt-3 text-sm space-y-1 text-muted-foreground">
                <p><span className="font-medium text-foreground">Judul:</span> {previewDoc.title}</p>
                <p><span className="font-medium text-foreground">File:</span> {previewDoc.fileName}</p>
                <p><span className="font-medium text-foreground">Tipe:</span> {getFileType(previewDoc.mimetype, previewDoc.fileName)}</p>
                <p><span className="font-medium text-foreground">Chunks:</span> {previewDoc.chunkCount}</p>
                <p><span className="font-medium text-foreground">Panjang teks:</span> {previewDoc.textLength?.toLocaleString("id-ID") || 0}</p>
                {previewDoc.localUrl && (
                  <p>
                    <span className="font-medium text-foreground">File URL:</span>{" "}
                    <a className="text-blue-600 underline" href={`${BACKEND_BASE_URL}${previewDoc.localUrl}`} target="_blank" rel="noreferrer">
                      Buka file
                    </a>
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => setPreviewDoc(null)}
              className="p-2 rounded-md hover:bg-muted transition"
              title="Tutup Detail"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/50 sticky top-0">
            <tr>
              <th className="px-6 py-4 font-medium">Judul Dokumen</th>
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
                    <p>Memuat dokumen knowledge base...</p>
                  </div>
                </td>
              </tr>
            ) : documents.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <FileText className="w-12 h-12 text-muted-foreground/30" />
                    <p>Belum ada dokumen di knowledge base.</p>
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
                    {getFileType(doc.mimetype, doc.fileName)}
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
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setPreviewDoc(doc)}
                        className="p-2 text-slate-600 hover:bg-slate-50 rounded-md transition"
                        title="Read / Detail Dokumen"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(doc)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition"
                        title="Update Dokumen"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(doc.id, doc.title)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-md transition"
                        title="Delete Dokumen"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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
