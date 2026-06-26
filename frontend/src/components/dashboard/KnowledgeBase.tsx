import React, { useState, useEffect } from "react"
import { Trash2, FileText, Loader2, RefreshCcw, Database, RotateCw, Upload, Edit3, Save, X, Eye, AlertTriangle } from "lucide-react"
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
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null)

  // Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [editingDoc, setEditingDoc] = useState<DocumentItem | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editSourceUrl, setEditSourceUrl] = useState("")
  const [editText, setEditText] = useState("")
  const [replacementFile, setReplacementFile] = useState<File | null>(null)

  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [docToDelete, setDocToDelete] = useState<{ id: string, title: string, fileName: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

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
        headers: { ...authHeaders(), "Content-Type": "application/json" },
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

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadFile) {
      alert("Pilih file terlebih dahulu.")
      return
    }

    setIsUploading(true)
    const formData = new FormData()
    formData.append("file", uploadFile)
    formData.append("title", uploadFile.name)

    try {
      const response = await fetch(`${API_BASE_URL}/documents/upload`, {
        method: "POST",
        headers: authHeaders(),
        body: formData,
      })
      const result = await response.json()
      if (result.success) {
        setIsUploadModalOpen(false)
        setUploadFile(null)
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
    }
  }

  const handleOpenEdit = (doc: DocumentItem) => {
    setEditingDoc(doc)
    setEditTitle(doc.title)
    setEditSourceUrl(doc.sourceUrl || "")
    setEditText("")
    setReplacementFile(null)
    setIsEditModalOpen(true)
  }

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
        const payload: any = {
          title: editTitle.trim(),
          sourceUrl: editSourceUrl.trim() || null,
        }
        if (editText.trim()) {
          payload.extractedText = editText.trim()
        }

        response = await fetch(`${API_BASE_URL}/admin/datasets/${editingDoc.id}`, {
          method: "PUT",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      }

      const result = await response.json()

      if (result.status === "success" || result.success) {
        setIsEditModalOpen(false)
        setEditingDoc(null)
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

  const handleOpenDelete = (doc: DocumentItem) => {
    setDocToDelete({ id: doc.id, title: doc.title, fileName: doc.fileName })
    setIsDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!docToDelete) return
    setIsDeleting(true)
    try {
      const response = await fetch(`${API_BASE_URL}/admin/datasets/${docToDelete.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      })
      const result = await response.json()
      if (result.status === "success") {
        setIsDeleteModalOpen(false)
        setDocToDelete(null)
        await fetchDocuments()
        await fetchSyncStatus()
      } else {
        alert("Gagal menghapus: " + result.message)
      }
    } catch (error) {
      console.error("Delete error:", error)
      alert("Terjadi kesalahan saat menghapus dataset.")
    } finally {
      setIsDeleting(false)
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
    <>
      <div className="flex flex-col bg-card rounded-xl border shadow-sm mb-8">
        <div className="p-4 md:p-5 border-b flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Knowledge Base</h2>
            <p className="text-sm text-muted-foreground">
              CRUD per dokumen PDF, DOCX, XLSX, dan TXT. Semua tersimpan ke Aiven dan dipakai chatbot.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                fetchDocuments()
                fetchSyncStatus()
              }}
              className="h-10 px-3 border rounded-md hover:bg-muted transition flex items-center justify-center text-muted-foreground"
              title="Refresh Daftar"
            >
              <RefreshCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="h-10 flex items-center gap-2 px-4 border border-input bg-background rounded-md hover:bg-muted transition text-sm font-medium whitespace-nowrap"
            >
              <Upload className="w-4 h-4" />
              Create / Upload
            </button>

            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="h-10 flex items-center gap-2 px-4 bg-primary text-white rounded-md hover:bg-primary/90 transition disabled:opacity-50 text-sm font-medium whitespace-nowrap"
            >
              {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
              {isSyncing ? "Sinkronisasi..." : "Sync Knowledge Base"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 md:p-5 border-b">
          <div className="rounded-lg border p-3 bg-muted/20">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Database className="w-4 h-4" />
              Total Dokumen
            </div>
            <p className="text-2xl font-bold mt-2">{documents.length}</p>
          </div>
          <div className="rounded-lg border p-3 bg-muted/20">
            <div className="text-sm text-muted-foreground">Total Chunks</div>
            <p className="text-2xl font-bold mt-2">
              {syncStatus?.totalChunks ?? documents.reduce((total, doc) => total + doc.chunkCount, 0)}
            </p>
          </div>
          <div className="rounded-lg border p-3 bg-muted/20">
            <div className="text-sm text-muted-foreground">Status Sync</div>
            <p className="text-sm font-medium mt-2 line-clamp-2" title={syncStatus?.message}>
              {syncStatus?.message || "Belum ada status"}
            </p>
          </div>
          <div className="rounded-lg border p-3 bg-muted/20">
            <div className="text-sm text-muted-foreground">Terakhir Sync</div>
            <p className="text-sm font-medium mt-2">
              {syncStatus?.lastSyncAt
                ? new Date(syncStatus.lastSyncAt).toLocaleString("id-ID")
                : "-"}
            </p>
          </div>
        </div>



        <div className="p-4 md:p-5 bg-gray-50/50 rounded-b-xl">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <p>Memuat dokumen knowledge base...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground bg-white border border-dashed rounded-xl">
              <FileText className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <p>Belum ada dokumen di knowledge base.</p>
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="mt-4 text-sm text-primary hover:underline font-medium"
              >
                Upload dokumen pertama Anda
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {documents.map((doc) => (
                <div 
                  key={doc.id} 
                  className="bg-white border rounded-xl p-5 hover:shadow-md transition-shadow flex flex-col lg:flex-row lg:items-center justify-between gap-4 w-full overflow-hidden"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start sm:items-center gap-4 mb-2">
                      <div className="p-2.5 bg-red-50 text-red-600 rounded-lg shrink-0 mt-1 sm:mt-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 
                          className="text-lg font-bold text-gray-900 break-words line-clamp-2" 
                          title={doc.title}
                        >
                          {doc.title}
                        </h4>
                        <p 
                          className="text-sm text-gray-500 break-words line-clamp-2 mt-0.5" 
                          title={doc.fileName}
                        >
                          {doc.fileName}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 mt-3 sm:ml-14 text-sm">
                      <span className="inline-flex shrink-0 items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700">
                        {getFileType(doc.mimetype, doc.fileName)}
                      </span>
                      <span className="inline-flex shrink-0 items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        <Database className="w-3 h-3 mr-1" />
                        {doc.chunkCount} chunks
                      </span>
                      <span className="text-gray-500 text-xs hidden sm:inline-block">
                        &bull;
                      </span>
                      <span className="text-gray-500 text-xs shrink-0">
                        {doc.textLength?.toLocaleString("id-ID") || 0} karakter
                      </span>
                      <span className="text-gray-500 text-xs hidden sm:inline-block">
                        &bull;
                      </span>
                      <span className="text-gray-400 text-xs shrink-0">
                        Diperbarui: {doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" }) : "-"}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end mt-2 pt-4 lg:mt-0 lg:pt-0 border-t lg:border-t-0 border-gray-100">
                    <button
                      onClick={() => setPreviewDoc(doc)}
                      className="h-9 w-9 rounded-lg border flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      title="Detail Dokumen"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenEdit(doc)}
                      className="h-9 w-9 rounded-lg border border-blue-200 flex items-center justify-center text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Update Dokumen"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenDelete(doc)}
                      className="h-9 w-9 rounded-lg border border-red-200 flex items-center justify-center text-red-600 hover:bg-red-50 transition-colors"
                      title="Hapus Dokumen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden relative">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-lg text-slate-800">Upload Dokumen</h3>
              <button 
                onClick={() => !isUploading && setIsUploadModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUploadSubmit} className="p-5 space-y-5">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-slate-700">Pilih File</label>
                <input
                  type="file"
                  accept=".pdf,.docx,.xlsx,.txt"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 border border-slate-200 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  required
                />
                <p className="text-xs text-slate-500 mt-2">
                  Format yang didukung: PDF, DOCX, XLSX, TXT.
                </p>
                <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-md flex gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">File .doc belum didukung. Silakan konversi ke .docx terlebih dahulu.</p>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  disabled={isUploading}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md transition disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !uploadFile}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 transition disabled:opacity-50"
                >
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {isUploading ? "Mengunggah..." : "Upload Sekarang"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && editingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden relative my-auto">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-lg text-slate-800 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-600" />
                Edit Dokumen
              </h3>
              <button 
                onClick={() => !isUpdating && setIsEditModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateSubmit} className="p-5 overflow-y-auto max-h-[75vh]">
              <div className="mb-5 p-3 bg-blue-50 border border-blue-100 rounded-md text-sm text-blue-800">
                <p><strong>File saat ini:</strong> {editingDoc.fileName}</p>
                <p className="text-xs mt-1 text-blue-600">Anda dapat memperbarui metadata atau mengganti file secara utuh. Jika diganti, chunk lama akan otomatis dihapus.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-slate-700">Judul Dokumen <span className="text-red-500">*</span></label>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                    placeholder="Masukkan judul"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-slate-700">Source URL / Link Sumber</label>
                  <input
                    value={editSourceUrl}
                    onChange={(e) => setEditSourceUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                    placeholder="Contoh: https://ssc.telu.ac.id/..."
                  />
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-sm font-medium mb-1.5 text-slate-700">File Pengganti (Opsional)</label>
                <input
                  type="file"
                  accept=".pdf,.docx,.xlsx,.txt"
                  onChange={(e) => setReplacementFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 border border-slate-200 rounded-md p-2 focus:outline-none transition-all"
                />
                <p className="text-xs text-slate-500 mt-2">
                  Abaikan jika tidak ingin mengganti isi dokumen. Format: PDF, DOCX, XLSX, TXT (Bukan .doc).
                </p>
              </div>

              <div className="mb-5">
                <label className="block text-sm font-medium mb-1.5 text-slate-700">Isi Teks Baru Manual (Opsional)</label>
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono text-sm"
                  placeholder="Gunakan hanya jika Anda ingin override chunk text secara manual tanpa upload file."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={isUpdating}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md transition disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {isUpdating ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && docToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden relative">
            <div className="p-5 flex flex-col items-center text-center pt-8">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-xl text-slate-900 mb-2">Hapus Dokumen?</h3>
              <p className="text-slate-500 text-sm mb-1">
                Anda yakin ingin menghapus dokumen ini?
              </p>
              <p className="font-semibold text-slate-800 break-words line-clamp-2 max-w-full px-4 mb-4">
                "{docToDelete.title}"
              </p>
              <div className="bg-red-50 p-4 rounded-lg border border-red-100 w-full mb-6 text-left">
                <ul className="list-disc pl-5 space-y-2 text-sm text-red-800 leading-relaxed">
                  <li>Dokumen ini akan dihapus dari Knowledge Base.</li>
                  <li>Semua chunk yang berkaitan dengan dokumen ini juga akan ikut dihapus.</li>
                  <li>Chatbot tidak akan lagi menggunakan dokumen ini sebagai referensi.</li>
                </ul>
              </div>
            </div>
            <div className="flex bg-slate-50 border-t border-slate-100 p-4 gap-3 justify-end">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition shadow-sm disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {isDeleting ? "Menghapus..." : "Ya, Hapus Dokumen"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Detail Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden relative">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-lg text-slate-800 flex items-center gap-2">
                <Eye className="w-5 h-5 text-slate-600" />
                Detail Dokumen
              </h3>
              <button 
                onClick={() => setPreviewDoc(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <div className="space-y-3 text-sm text-slate-600">
                <p><strong className="text-slate-900 inline-block w-28">Judul:</strong> {previewDoc.title}</p>
                <p><strong className="text-slate-900 inline-block w-28">File:</strong> {previewDoc.fileName}</p>
                <p><strong className="text-slate-900 inline-block w-28">Tipe:</strong> {getFileType(previewDoc.mimetype, previewDoc.fileName)}</p>
                <p><strong className="text-slate-900 inline-block w-28">Chunks:</strong> {previewDoc.chunkCount}</p>
                <p><strong className="text-slate-900 inline-block w-28">Panjang teks:</strong> {previewDoc.textLength?.toLocaleString("id-ID") || 0} karakter</p>
                <p><strong className="text-slate-900 inline-block w-28">Diperbarui:</strong> {previewDoc.updatedAt ? new Date(previewDoc.updatedAt).toLocaleString("id-ID") : "-"}</p>
                {previewDoc.localUrl ? (
                  <p className="pt-2">
                    <strong className="text-slate-900 inline-block w-28">File URL:</strong>{" "}
                    <a className="text-blue-600 hover:underline font-medium inline-flex items-center gap-1" href={`${BACKEND_BASE_URL}${previewDoc.localUrl}`} target="_blank" rel="noreferrer">
                      Buka file di tab baru &rarr;
                    </a>
                  </p>
                ) : (
                  <p className="pt-2 text-slate-400 italic">File tidak memiliki URL yang bisa diakses langsung.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
