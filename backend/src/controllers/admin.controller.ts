import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { pool } from "../config/database";
import {
  createTextDataset,
  deleteDocumentById,
  getAllDocumentChunks,
  getAllDocuments,
  importDatasetFromFolder,
  updateTextDataset,
  updateChunkText,
} from "../services/document.service";
import { searchRelevantChunks } from "../services/rag.service";
import fs from "fs";
import path from "path";

export const getDashboardStats = async (_req: Request, res: Response) => {
  try {
    const [userRows]: any = await pool.query("SELECT COUNT(*) as total FROM users WHERE role = 'user'");
    
    const [docStats]: any = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN fileName LIKE '%.pdf' OR mimetype LIKE '%pdf%' THEN 1 ELSE 0 END) as pdfCount,
        SUM(CASE WHEN fileName LIKE '%.docx' OR mimetype LIKE '%word%' THEN 1 ELSE 0 END) as docxCount,
        SUM(CASE WHEN fileName LIKE '%.xlsx' OR mimetype LIKE '%sheet%' THEN 1 ELSE 0 END) as xlsxCount,
        SUM(CASE WHEN fileName LIKE '%.txt' OR mimetype LIKE '%text%' THEN 1 ELSE 0 END) as txtCount,
        MAX(updatedAt) as lastUpload
      FROM documents WHERE deletedAt IS NULL
    `);

    const [latestDoc]: any = await pool.query(
      "SELECT title, updatedAt FROM documents WHERE deletedAt IS NULL ORDER BY COALESCE(NULLIF(updatedAt, ''), uploadedAt) DESC LIMIT 1"
    );

    const [chunkRows]: any = await pool.query("SELECT COUNT(*) as total FROM document_chunks");
    const [chatSessionRows]: any = await pool.query("SELECT COUNT(*) as total FROM chat_sessions");
    const [chatMessageRows]: any = await pool.query("SELECT COUNT(*) as total FROM chat_messages");

    return res.json({
      status: "success",
      data: {
        totalUsers: userRows[0].total,
        totalDatasets: docStats[0].total || 0,
        pdfCount: docStats[0].pdfCount || 0,
        docxCount: docStats[0].docxCount || 0,
        xlsxCount: docStats[0].xlsxCount || 0,
        txtCount: docStats[0].txtCount || 0,
        lastUpload: docStats[0].lastUpload,
        latestDocument: latestDoc.length ? latestDoc[0].title : null,
        totalChunks: chunkRows[0].total,
        activeChats: chatSessionRows[0].total,
        totalMessages: chatMessageRows[0].total,
        aiTokensUsed: chatMessageRows[0].total * 15,
      },
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return res.status(500).json({ status: "error", message: "Gagal mengambil statistik" });
  }
};

export const getNotifications = async (_req: Request, res: Response) => {
  try {
    const [userRows]: any = await pool.query(
      "SELECT id, name, email, createdAt FROM users WHERE role = 'user' ORDER BY createdAt DESC, id DESC LIMIT 5"
    );

    const userActivities = userRows.map((user: any) => ({
      id: `user-${user.id}`,
      type: "register",
      name: user.name,
      action: "mendaftar akun baru",
      created_at: user.createdAt || new Date().toISOString(),
    }));

    const [sessionRows]: any = await pool.query(
      "SELECT id, createdAt FROM chat_sessions ORDER BY createdAt DESC LIMIT 5"
    );

    const chatActivities = sessionRows.map((session: any) => ({
      id: `chat-${session.id}`,
      type: "chat",
      name: "Mahasiswa",
      action: "menggunakan chatbot",
      created_at: session.createdAt,
    }));

    const allActivities = [...userActivities, ...chatActivities].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return res.json({
      status: "success",
      data: allActivities.slice(0, 10),
    });
  } catch (error) {
    return res.status(500).json({ status: "error", message: "Gagal mengambil notifikasi" });
  }
};

export const getAllAdmins = async (_req: Request, res: Response) => {
  const [rows]: any = await pool.query(
    "SELECT id, name, email, role, createdAt FROM users WHERE role = 'admin' ORDER BY createdAt DESC, id DESC"
  );

  return res.json({
    status: "success",
    message: "Data admin berhasil diambil dari Aiven",
    data: rows,
  });
};

export const getAdminById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const [rows]: any = await pool.query(
    "SELECT id, name, email, role, createdAt FROM users WHERE id = ? AND role = 'admin' LIMIT 1",
    [id]
  );

  if (!rows.length) {
    return res.status(404).json({ status: "error", message: "Admin tidak ditemukan" });
  }

  return res.json({
    status: "success",
    message: "Detail admin berhasil diambil",
    data: rows[0],
  });
};

export const createAdmin = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ status: "error", message: "Nama, email, dan password wajib diisi" });
    }

    const [existing]: any = await pool.query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
    if (existing.length > 0) {
      return res.status(400).json({ status: "error", message: "Email sudah terdaftar" });
    }

    const id = Date.now().toString();
    const passwordHash = await bcrypt.hash(password, 10);
    const createdAt = new Date().toISOString();

    await pool.query(
      "INSERT INTO users (id, name, email, passwordHash, role, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
      [id, name, email, passwordHash, "admin", createdAt]
    );

    return res.status(201).json({
      status: "success",
      message: "Admin berhasil ditambahkan ke Aiven",
      data: { id, name, email, role: "admin", createdAt },
    });
  } catch (error) {
    return res.status(500).json({ status: "error", message: "Gagal menambahkan admin" });
  }
};

export const updateAdmin = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, password } = req.body;

    const [rows]: any = await pool.query("SELECT * FROM users WHERE id = ? AND role = 'admin' LIMIT 1", [id]);
    if (!rows.length) {
      return res.status(404).json({ status: "error", message: "Admin tidak ditemukan" });
    }

    const nextName = name || rows[0].name;
    const nextEmail = email || rows[0].email;
    const nextPasswordHash = password ? await bcrypt.hash(password, 10) : rows[0].passwordHash;

    await pool.query(
      "UPDATE users SET name = ?, email = ?, passwordHash = ? WHERE id = ? AND role = 'admin'",
      [nextName, nextEmail, nextPasswordHash, id]
    );

    return res.json({
      status: "success",
      message: "Admin berhasil diperbarui di Aiven",
      data: { id, name: nextName, email: nextEmail, role: "admin" },
    });
  } catch (error) {
    return res.status(500).json({ status: "error", message: "Gagal memperbarui admin" });
  }
};

export const deleteAdmin = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [result]: any = await pool.query("DELETE FROM users WHERE id = ? AND role = 'admin'", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ status: "error", message: "Admin tidak ditemukan" });
    }

    return res.json({ status: "success", message: "Admin berhasil dihapus dari Aiven" });
  } catch (error) {
    return res.status(500).json({ status: "error", message: "Gagal menghapus admin" });
  }
};

let syncStatus = {
  isSyncing: false,
  lastSyncAt: null as string | null,
  message: "Belum ada proses sinkronisasi",
  totalDocuments: 0,
  totalChunks: 0,
};

async function refreshSyncStatus(message: string) {
  const docs = await getAllDocuments();
  const chunks = await getAllDocumentChunks({ preferDatabaseOnly: true });

  syncStatus = {
    isSyncing: false,
    lastSyncAt: new Date().toISOString(),
    message,
    totalDocuments: docs.length,
    totalChunks: chunks.length,
  };
}

async function runAutoSync() {
  syncStatus = {
    ...syncStatus,
    isSyncing: true,
    message: "Sinkronisasi Aiven sedang berjalan",
  };

  const result = await importDatasetFromFolder();
  await refreshSyncStatus("Sinkronisasi Aiven selesai");

  return result;
}

export const getDatasetList = async (_req: Request, res: Response) => {
  try {
    const docs = await getAllDocuments();

    return res.json({
      status: "success",
      message: "Dataset berhasil diambil dari Aiven",
      data: docs.map((doc) => ({
        id: doc.id,
        title: doc.title,
        fileName: doc.originalName || doc.fileName,
        storedFileName: doc.fileName,
        mimetype: doc.mimetype,
        sourceUrl: doc.sourceUrl || null,
        localUrl: doc.localUrl || doc.url,
        textLength: doc.textLength || 0,
        chunkCount: doc.totalChunks || 0,
        updatedAt: doc.updatedAt || doc.uploadedAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({ status: "error", message: "Gagal mengambil dataset" });
  }
};

export const createDataset = async (req: Request, res: Response) => {
  try {
    const { title, fileName, mimetype, sourceUrl, localUrl, extractedText } = req.body;

    if (!title || !extractedText) {
      return res.status(400).json({ status: "error", message: "title dan extractedText wajib diisi" });
    }

    const result = await createTextDataset({
      title,
      fileName,
      mimetype,
      sourceUrl,
      localUrl,
      extractedText,
    });

    await refreshSyncStatus("Dataset baru berhasil masuk Aiven dan chunks chatbot");

    return res.status(201).json({
      status: "success",
      message: "Dataset berhasil ditambahkan ke Aiven dan langsung terbaca chatbot",
      data: result.document,
    });
  } catch (error: any) {
    return res.status(500).json({ status: "error", message: error?.message || "Gagal menambahkan dataset" });
  }
};

export const updateDataset = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, sourceUrl, extractedText } = req.body;

    const result = await updateTextDataset(String(id), { title, sourceUrl, extractedText });

    if (!result.updated) {
      return res.status(404).json({ status: "error", message: result.message });
    }

    await refreshSyncStatus("Dataset berhasil diperbarui di Aiven dan chunks chatbot");

    return res.json({
      status: "success",
      message: "Dataset berhasil diperbarui dan langsung sinkron dengan chatbot",
      data: result.document,
    });
  } catch (error: any) {
    return res.status(500).json({ status: "error", message: error?.message || "Gagal memperbarui dataset" });
  }
};

export const deleteDataset = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await deleteDocumentById(String(id));

    if (!result.deleted) {
      return res.status(404).json({ status: "error", message: result.message });
    }

    await refreshSyncStatus("Dataset berhasil dihapus dari Aiven dan chunks chatbot");

    return res.json({
      status: "success",
      message: result.message,
    });
  } catch (error) {
    return res.status(500).json({ status: "error", message: "Gagal menghapus dataset" });
  }
};

export const syncDataset = async (_req: Request, res: Response) => {
  try {
    const result = await runAutoSync();

    return res.json({
      status: "success",
      message: "Sinkronisasi dataset ke Aiven berhasil",
      data: { result, syncStatus },
    });
  } catch (error) {
    syncStatus = {
      ...syncStatus,
      isSyncing: false,
      message: "Sinkronisasi gagal",
    };

    return res.status(500).json({ status: "error", message: "Gagal melakukan sinkronisasi dataset" });
  }
};

export const getSyncStatus = async (_req: Request, res: Response) => {
  try {
    await refreshSyncStatus(syncStatus.message || "Status sinkronisasi diperbarui");
  } catch (error) {
    // Tetap kirim status terakhir agar dashboard tidak blank.
  }

  return res.json({ status: "success", data: syncStatus });
};

export const getDocumentChunksById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [rows]: any = await pool.query(
      `
        SELECT c.documentId, c.documentTitle, c.chunkIndex, c.text, c.documentUrl, d.sourceUrl 
        FROM document_chunks c
        INNER JOIN documents d ON d.id = c.documentId
        WHERE c.documentId = ? AND d.deletedAt IS NULL
        ORDER BY c.chunkIndex ASC
      `,
      [id]
    );

    return res.json({ status: "success", data: rows });
  } catch (error) {
    console.error("Failed to fetch chunks:", error);
    return res.status(500).json({ status: "error", message: "Gagal mengambil chunks" });
  }
};

export const getScrapedData = async (_req: Request, res: Response) => {
  try {
    const scrapedPath = path.join(process.cwd(), "src", "data", "scrapedDataset.json");
    if (!fs.existsSync(scrapedPath)) {
      return res.json({ status: "success", data: [], message: "scrapedDataset.json tidak ditemukan." });
    }
    const raw = fs.readFileSync(scrapedPath, "utf-8");
    const data = raw.trim() ? JSON.parse(raw) : [];
    
    // Format to indicate this is a cache/legacy dataset
    const formattedData = data.map((item: any) => ({
      ...item,
      isLegacyCache: true,
      textLength: item.text?.length || 0,
      totalChunks: item.chunks?.length || 0,
    }));

    return res.json({ status: "success", data: formattedData });
  } catch (error) {
    console.error("Failed to read scraped data:", error);
    return res.status(500).json({ status: "error", message: "Gagal mengambil scraped data cache" });
  }
};

export const queryTestRag = async (req: Request, res: Response) => {
  try {
    const { query, topK = 5 } = req.body;
    if (!query) {
      return res.status(400).json({ status: "error", message: "Query text diperlukan" });
    }

    const allChunks = await getAllDocumentChunks();
    const relevantChunks = await searchRelevantChunks(query, allChunks, {
      topK: Number(topK),
      minScore: 0.0, // allow seeing lower score matches for debugging
    });

    const matches = relevantChunks.map(c => ({
      documentId: c.documentId,
      documentTitle: c.documentTitle,
      chunkIndex: (c as any).chunkIndex, // chunkIndex is implicitly preserved or added via indexing
      score: c.score,
      text: c.text,
      sourceUrl: c.documentUrl,
    }));

    return res.json({
      success: true,
      query,
      matches,
    });
  } catch (error) {
    console.error("Query test failed:", error);
    return res.status(500).json({ status: "error", message: "Gagal melakukan query testing" });
  }
};

export const updateDocumentChunk = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!text || text.trim() === "") {
      return res.status(400).json({ status: "error", message: "Teks potongan informasi tidak boleh kosong" });
    }

    const result = await updateChunkText(String(id), text.trim());
    if (!result.updated) {
      return res.status(404).json({ status: "error", message: result.message });
    }

    return res.json({ status: "success", message: "Potongan informasi berhasil diperbarui" });
  } catch (error) {
    console.error("Update chunk error:", error);
    return res.status(500).json({ status: "error", message: "Gagal memperbarui potongan informasi" });
  }
};

export const getDocumentText = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [rows]: any = await pool.query("SELECT extractedText FROM documents WHERE id = ? LIMIT 1", [id]);
    if (!rows.length) {
      return res.status(404).json({ status: "error", message: "Dokumen tidak ditemukan" });
    }
    return res.json({ status: "success", data: rows[0].extractedText });
  } catch (error) {
    console.error("Get document text error:", error);
    return res.status(500).json({ status: "error", message: "Gagal mengambil teks dokumen" });
  }
};
