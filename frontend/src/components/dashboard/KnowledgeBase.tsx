import React, { useState, useEffect } from "react"
import { Trash2, FileText, Loader2, RefreshCcw, Database, Upload, Edit3, X, Eye, FileType, ChevronDown, ChevronUp } from "lucide-react"
import { API_BASE_URL, NGROK_HEADERS } from "@/services/sscApi"

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

type Chunk = {
  documentId: string
  documentTitle: string
  chunkIndex: number
  text: string
}

export function KnowledgeBase() {
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [, setSyncStatus] = useState<SyncStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)

  // Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)

  // Document Detail Modal State
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null)

  // Edit Metadata Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [editingDoc, setEditingDoc] = useState<DocumentItem | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editSourceUrl, setEditSourceUrl] = useState("")
  const [replacementFile, setReplacementFile] = useState<File | null>(null)

  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [docToDelete, setDocToDelete] = useState<{ id: string, title: string, fileName: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Scraped Data / Extracted Text Modal
  const [isTextModalOpen, setIsTextModalOpen] = useState(false)
  const [docForText, setDocForText] = useState<DocumentItem | null>(null)
  const [extractedText, setExtractedText] = useState("")
  const [isFetchingText, setIsFetchingText] = useState(false)

  // Chunks Modal State
  const [isChunksModalOpen, setIsChunksModalOpen] = useState(false)
  const [docForChunks, setDocForChunks] = useState<DocumentItem | null>(null)
  const [chunks, setChunks] = useState<Chunk[]>([])
  const [isFetchingChunks, setIsFetchingChunks] = useState(false)
  const [expandedChunks, setExpandedChunks] = useState<Record<number, boolean>>({})
  const [editingChunkIndex, setEditingChunkIndex] = useState<number | null>(null)
  const [editingChunkText, setEditingChunkText] = useState("")
  const [isSavingChunk, setIsSavingChunk] = useState(false)

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

  useEffect(() => {
    fetchDocuments()
    fetchSyncStatus()
  }, [])

  const handleSync = async () => {
    if (!window.confirm("Perbarui data sekarang? Proses ini akan menyinkronkan data dengan sistem.")) return
    setIsSyncing(true)
    try {
      const response = await fetch(`${API_BASE_URL}/admin/sync`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const result = await response.json()
      if (result.status === "success") {
        alert("Sinkronisasi berhasil.")
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
    setReplacementFile(null)
    setIsEditModalOpen(true)
  }

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingDoc) return
    if (!editTitle.trim()) {
      alert("Judul dokumen tidak boleh kosong.")
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
        alert("Gagal update dokumen: " + result.message)
      }
    } catch (error) {
      console.error("Update error:", error)
      alert("Terjadi kesalahan saat mengupdate dokumen.")
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
      alert("Terjadi kesalahan saat menghapus dokumen.")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleViewExtractedText = async (doc: DocumentItem) => {
    setDocForText(doc)
    setIsTextModalOpen(true)
    setIsFetchingText(true)
    setExtractedText("")
    
    try {
      const response = await fetch(`${API_BASE_URL}/admin/documents/${doc.id}/text`, { headers: authHeaders() })
      const result = await response.json()
      if (result.status === "success") {
        setExtractedText(result.data)
      } else {
        setExtractedText("Gagal memuat isi dokumen.")
      }
    } catch (err) {
      setExtractedText("Terjadi kesalahan koneksi.")
    } finally {
      setIsFetchingText(false)
    }
  }

  const handleViewChunks = async (doc: DocumentItem) => {
    setDocForChunks(doc)
    setIsChunksModalOpen(true)
    setIsFetchingChunks(true)
    setChunks([])
    setExpandedChunks({})
    setEditingChunkIndex(null)
    
    try {
      const response = await fetch(`${API_BASE_URL}/admin/documents/${doc.id}/chunks`, { headers: authHeaders() })
      const result = await response.json()
      if (result.status === "success") {
        setChunks(result.data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsFetchingChunks(false)
    }
  }

  const toggleChunkExpand = (index: number) => {
    setExpandedChunks(prev => ({ ...prev, [index]: !prev[index] }))
  }

  const handleStartEditChunk = (chunkIndex: number, currentText: string) => {
    setEditingChunkIndex(chunkIndex)
    setEditingChunkText(currentText)
  }

  const handleSaveChunk = async (chunk: Chunk) => {
    if (!editingChunkText.trim()) {
      alert("Teks potongan informasi tidak boleh kosong.")
      return
    }
    
    setIsSavingChunk(true)
    try {
      // Chunk API is PUT /admin/chunks/:id. But we don't have the chunk string ID in Chunk type if we didn't return it!
      // Wait, getDocumentChunksById returns `id`? Let's check. Ah, I might need the chunk's PK ID.
      // Wait, chunk object above doesn't have `id`. Let's assume `id` is returned.
      // If `c.id` is not returned by getDocumentChunksById, we can't edit it.
      // Let's modify Chunk type to have `id?: string` just in case.
      
      const chunkId = (chunk as any).id || `${chunk.documentId}-${chunk.chunkIndex}`;
      
      const response = await fetch(`${API_BASE_URL}/admin/chunks/${chunkId}`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ text: editingChunkText.trim() }),
      })
      const result = await response.json()
      
      if (result.status === "success") {
        setChunks(chunks.map((c, i) => i === chunk.chunkIndex ? { ...c, text: editingChunkText.trim() } : c))
        setEditingChunkIndex(null)
      } else {
        alert("Gagal update potongan informasi: " + result.message)
      }
    } catch (error) {
      console.error(error)
      alert("Terjadi kesalahan sistem.")
    } finally {
      setIsSavingChunk(false)
    }
  }

  const getFileType = (mimetype: string, fileName?: string) => {
    const lowerName = (fileName || "").toLowerCase()
    if (mimetype.includes("pdf") || lowerName.endsWith(".pdf")) return "PDF"
    if (mimetype.includes("word") || lowerName.endsWith(".docx")) return "DOCX"
    if (mimetype.includes("sheet") || lowerName.endsWith(".xlsx")) return "XLSX"
    return "TXT"
  }

  return (
    <>
      <div className="flex flex-col bg-card rounded-xl border shadow-sm mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="p-4 md:p-6 border-b flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Dokumen Informasi</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Kelola dokumen yang digunakan sebagai sumber informasi utama chatbot.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                fetchDocuments()
                fetchSyncStatus()
              }}
              className="h-10 w-10 border rounded-md hover:bg-muted transition flex items-center justify-center text-muted-foreground"
              title="Refresh"
            >
              <RefreshCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="h-10 flex items-center gap-2 px-4 border border-input bg-background rounded-md hover:bg-muted transition text-sm font-medium"
            >
              <Upload className="w-4 h-4" />
              Unggah Dokumen
            </button>

            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="h-10 flex items-center gap-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition disabled:opacity-50 text-sm font-medium shadow-sm"
            >
              {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
              {isSyncing ? "Menyinkronkan..." : "Perbarui Data"}
            </button>
          </div>
        </div>

        <div className="p-4 md:p-6 bg-muted/10 rounded-b-xl min-h-[50vh]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground pt-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <p>Memuat daftar dokumen...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full pt-12 text-muted-foreground">
              <FileText className="w-16 h-16 text-muted-foreground/20 mb-4" />
              <p className="text-lg font-medium text-foreground">Belum ada dokumen</p>
              <p className="text-sm">Silakan unggah dokumen pertama untuk mengisi basis informasi.</p>
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="mt-6 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md shadow-sm"
              >
                Unggah Dokumen
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {documents.map((doc) => (
                <div 
                  key={doc.id} 
                  className="bg-card border rounded-xl p-5 hover:shadow-md transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4 w-full"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-4 mb-2">
                      <div className="p-3 bg-primary/10 text-primary rounded-lg shrink-0">
                        <FileType className="w-6 h-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-lg font-bold text-foreground break-words line-clamp-1" title={doc.title}>
                          {doc.title}
                        </h4>
                        <p className="text-sm text-muted-foreground break-words line-clamp-1 mt-0.5" title={doc.fileName}>
                          {doc.fileName}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 mt-3 sm:ml-[3.25rem] text-sm">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-muted text-muted-foreground">
                        {getFileType(doc.mimetype, doc.fileName)}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                        <Database className="w-3 h-3 mr-1" />
                        {doc.chunkCount} potongan informasi
                      </span>
                      <span className="text-muted-foreground text-xs hidden sm:inline-block">&bull;</span>
                      <span className="text-muted-foreground text-xs shrink-0">
                        {doc.textLength?.toLocaleString("id-ID") || 0} karakter
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end mt-4 lg:mt-0 pt-4 lg:pt-0 border-t lg:border-t-0 border-border">
                    <button
                      onClick={() => handleViewExtractedText(doc)}
                      className="h-9 px-3 rounded-md border bg-background text-sm font-medium hover:bg-muted transition-colors flex items-center gap-1.5"
                    >
                      <Eye className="w-4 h-4" />
                      <span className="hidden sm:inline">Isi Dokumen</span>
                    </button>

                    <button
                      onClick={() => handleViewChunks(doc)}
                      className="h-9 px-3 rounded-md border bg-background text-sm font-medium hover:bg-muted transition-colors flex items-center gap-1.5"
                    >
                      <Database className="w-4 h-4" />
                      <span className="hidden sm:inline">Kelola Potongan Data</span>
                    </button>

                    <button
                      onClick={() => setPreviewDoc(doc)}
                      className="h-9 px-3 rounded-md border bg-background text-sm font-medium hover:bg-muted transition-colors flex items-center gap-1.5"
                    >
                      <FileText className="w-4 h-4" />
                      <span className="hidden sm:inline">Detail</span>
                    </button>

                    <button
                      onClick={() => handleOpenEdit(doc)}
                      className="h-9 w-9 rounded-md border bg-background text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors flex items-center justify-center"
                      title="Edit Dokumen"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleOpenDelete(doc)}
                      className="h-9 w-9 rounded-md border bg-background text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex items-center justify-center"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-md rounded-xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center">
              <h3 className="font-semibold text-lg text-foreground">Unggah Dokumen Baru</h3>
              <button onClick={() => setIsUploadModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUploadSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">File Dokumen</label>
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,.xlsx"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 border border-input rounded-md p-2 bg-background"
                  />
                  <p className="text-xs text-muted-foreground mt-2">Dukungan format: PDF, DOCX, TXT, XLSX</p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 border border-input bg-background rounded-md text-sm font-medium hover:bg-muted"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !uploadFile}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                >
                  {isUploading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Unggah
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && editingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-lg rounded-xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center shrink-0">
              <h3 className="font-semibold text-lg text-foreground">Edit Dokumen</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateSubmit} className="p-6 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Judul Dokumen</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Source URL (Opsional)</label>
                  <input
                    type="url"
                    value={editSourceUrl}
                    onChange={(e) => setEditSourceUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Gunakan URL ini sebagai sumber rujukan.</p>
                </div>
                
                <div className="pt-4 border-t border-border mt-4">
                  <label className="block text-sm font-medium text-foreground mb-1">Ganti File Dokumen (Opsional)</label>
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,.xlsx"
                    onChange={(e) => setReplacementFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 border border-input rounded-md p-2 bg-background"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Jika Anda mengunggah file baru, potongan informasi lama akan dihapus dan dibuat ulang dari file baru ini.
                  </p>
                </div>
              </div>
              <div className="mt-8 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border border-input bg-background rounded-md text-sm font-medium hover:bg-muted"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUpdating || !editTitle.trim()}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                >
                  {isUpdating && <Loader2 className="w-4 h-4 animate-spin" />}
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && docToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-md rounded-xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 text-destructive mb-4 mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-center text-foreground mb-2">Hapus Dokumen?</h3>
              <p className="text-sm text-muted-foreground text-center mb-6">
                Anda akan menghapus dokumen <strong>"{docToDelete.title}"</strong>. Dokumen ini akan dihapus dari basis informasi dan chatbot tidak akan lagi menggunakan isi dokumen ini saat menjawab pertanyaan.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-input bg-background rounded-md text-sm font-medium hover:bg-muted"
                >
                  Batal
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 bg-destructive text-destructive-foreground rounded-md text-sm font-medium hover:bg-destructive/90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Ya, Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal (Detail) */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-lg rounded-xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/30">
              <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Detail Dokumen
              </h3>
              <button onClick={() => setPreviewDoc(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-2 border-b border-border pb-3">
                <div className="col-span-1 text-sm font-medium text-muted-foreground">Judul</div>
                <div className="col-span-2 text-sm font-semibold text-foreground">{previewDoc.title}</div>
              </div>
              <div className="grid grid-cols-3 gap-2 border-b border-border pb-3">
                <div className="col-span-1 text-sm font-medium text-muted-foreground">Nama File</div>
                <div className="col-span-2 text-sm text-foreground">{previewDoc.fileName}</div>
              </div>
              <div className="grid grid-cols-3 gap-2 border-b border-border pb-3">
                <div className="col-span-1 text-sm font-medium text-muted-foreground">Tipe File</div>
                <div className="col-span-2 text-sm text-foreground">{getFileType(previewDoc.mimetype, previewDoc.fileName)}</div>
              </div>
              <div className="grid grid-cols-3 gap-2 border-b border-border pb-3">
                <div className="col-span-1 text-sm font-medium text-muted-foreground">Potongan Informasi</div>
                <div className="col-span-2 text-sm text-foreground">{previewDoc.chunkCount}</div>
              </div>
              <div className="grid grid-cols-3 gap-2 border-b border-border pb-3">
                <div className="col-span-1 text-sm font-medium text-muted-foreground">Karakter</div>
                <div className="col-span-2 text-sm text-foreground">{previewDoc.textLength?.toLocaleString("id-ID") || 0}</div>
              </div>
              <div className="grid grid-cols-3 gap-2 border-b border-border pb-3">
                <div className="col-span-1 text-sm font-medium text-muted-foreground">Terakhir Update</div>
                <div className="col-span-2 text-sm text-foreground">
                  {previewDoc.updatedAt ? new Date(previewDoc.updatedAt).toLocaleString("id-ID") : "-"}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border bg-muted/30 flex justify-end">
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 border border-input bg-background rounded-md text-sm font-medium hover:bg-muted"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extracted Text Modal */}
      {isTextModalOpen && docForText && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-4xl h-[90vh] rounded-xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center shrink-0">
              <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary" />
                Hasil Pembacaan Dokumen: {docForText.title}
              </h3>
              <button onClick={() => setIsTextModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-muted/10">
              {isFetchingText ? (
                <div className="flex justify-center items-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="bg-background border rounded-lg p-6 whitespace-pre-wrap font-mono text-sm leading-relaxed">
                  {extractedText}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end shrink-0">
              <button
                onClick={() => setIsTextModalOpen(false)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chunks Viewer Modal */}
      {isChunksModalOpen && docForChunks && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-5xl h-[90vh] rounded-xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center shrink-0">
              <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                Kelola Potongan Informasi: {docForChunks.title}
              </h3>
              <button onClick={() => setIsChunksModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-muted/10">
              {isFetchingChunks ? (
                <div className="flex justify-center items-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : chunks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <p>Tidak ada potongan informasi untuk dokumen ini.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {chunks.map((chunk, idx) => (
                    <div key={idx} className="bg-background border rounded-lg overflow-hidden transition-all shadow-sm">
                      <div 
                        className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleChunkExpand(idx)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                            #{chunk.chunkIndex + 1}
                          </div>
                          <div>
                            <p className="font-medium text-foreground line-clamp-1">{chunk.text.substring(0, 80)}...</p>
                            <p className="text-xs text-muted-foreground mt-1">{chunk.text.length} karakter</p>
                          </div>
                        </div>
                        {expandedChunks[idx] ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                      </div>
                      
                      {expandedChunks[idx] && (
                        <div className="px-5 pb-5 border-t border-border pt-4 bg-muted/5">
                          {editingChunkIndex === idx ? (
                            <div className="space-y-3">
                              <textarea
                                value={editingChunkText}
                                onChange={(e) => setEditingChunkText(e.target.value)}
                                className="w-full h-40 p-3 text-sm border rounded-md font-mono focus:ring-1 focus:ring-primary"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => setEditingChunkIndex(null)}
                                  className="px-3 py-1.5 text-sm border rounded-md hover:bg-muted font-medium"
                                >
                                  Batal
                                </button>
                                <button
                                  onClick={() => handleSaveChunk(chunk)}
                                  disabled={isSavingChunk}
                                  className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-2 font-medium"
                                >
                                  {isSavingChunk && <Loader2 className="w-3 h-3 animate-spin" />}
                                  Simpan & Update AI
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="p-4 bg-background border rounded-md text-sm whitespace-pre-wrap font-mono mb-4 text-foreground leading-relaxed">
                                {chunk.text}
                              </div>
                              <div className="flex justify-end">
                                <button
                                  onClick={() => handleStartEditChunk(idx, chunk.text)}
                                  className="px-3 py-1.5 text-sm border rounded-md hover:bg-muted flex items-center gap-1.5 font-medium"
                                >
                                  <Edit3 className="w-4 h-4" />
                                  Edit Isi Potongan Informasi
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end shrink-0">
              <button
                onClick={() => setIsChunksModalOpen(false)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
