import { useState, useEffect, useRef } from "react"
import { Upload, Trash2, FileText, Loader2, RefreshCcw } from "lucide-react"

type DocumentItem = {
  id: string
  title: string
  mimetype: string
  chunkCount: number
  createdAt: string
  status: string
}

export function KnowledgeBase() {
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchDocuments = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("http://localhost:3000/api/documents")
      const result = await response.json()
      if (result.success) {
        setDocuments(result.documents)
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [])

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    const formData = new FormData()
    formData.append("file", file)

    try {
      const response = await fetch("http://localhost:3000/api/documents/upload", {
        method: "POST",
        body: formData,
      })
      const result = await response.json()
      if (result.success) {
        alert("Dokumen berhasil diunggah!")
        fetchDocuments()
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

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Yakin ingin menghapus dokumen "${title}"?`)) return

    try {
      const response = await fetch(`http://localhost:3000/api/documents/${id}`, {
        method: "DELETE",
      })
      const result = await response.json()
      if (result.success) {
        setDocuments(documents.filter((doc) => doc.id !== id))
      } else {
        alert("Gagal menghapus: " + result.message)
      }
    } catch (error) {
      console.error("Delete error:", error)
      alert("Terjadi kesalahan saat menghapus dokumen.")
    }
  }

  return (
    <div className="flex flex-col h-full bg-card rounded-xl border shadow-sm">
      <div className="p-6 border-b flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Knowledge Base</h2>
          <p className="text-sm text-muted-foreground">
            Kelola dokumen referensi yang akan digunakan chatbot untuk menjawab pertanyaan.
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={fetchDocuments}
            className="p-2 border rounded-md hover:bg-muted transition flex items-center justify-center text-muted-foreground"
            title="Refresh Daftar"
          >
            <RefreshCcw className="w-5 h-5" />
          </button>
          
          <button 
            onClick={handleUploadClick}
            disabled={isUploading}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition disabled:opacity-50"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {isUploading ? "Mengunggah..." : "Upload Dokumen"}
          </button>
          <input 
            type="file" 
            ref={fileInputRef}
            className="hidden" 
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
            onChange={handleFileChange}
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/50 sticky top-0">
            <tr>
              <th className="px-6 py-4 font-medium">Judul Dokumen</th>
              <th className="px-6 py-4 font-medium">Tipe File</th>
              <th className="px-6 py-4 font-medium">Potongan (Chunks)</th>
              <th className="px-6 py-4 font-medium">Tanggal Diunggah</th>
              <th className="px-6 py-4 font-medium text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <p>Memuat daftar dokumen...</p>
                  </div>
                </td>
              </tr>
            ) : documents.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <FileText className="w-12 h-12 text-muted-foreground/30" />
                    <p>Belum ada dokumen di Knowledge Base.</p>
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
                  <td className="px-6 py-4 text-muted-foreground">
                    {doc.mimetype.split('/').pop()?.toUpperCase().replace('VND.OPENXMLFORMATS-OFFICEDOCUMENT.WORDPROCESSINGML.DOCUMENT', 'DOCX')}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                      {doc.chunkCount} potongan
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {new Date(doc.createdAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => handleDelete(doc.id, doc.title)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-md transition"
                      title="Hapus Dokumen"
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
