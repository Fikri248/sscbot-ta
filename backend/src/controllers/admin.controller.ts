import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { pool } from "../config/database";
import { chatSessions, chatMessages } from "./chat1.controller";
import {
  createTextDataset,
  deleteDocumentById,
  getAllDocumentChunks,
  getAllDocuments,
  importDatasetFromFolder,
  updateTextDataset,
} from "../services/document.service";

export const getDashboardStats = async (_req: Request, res: Response) => {
  try {
    const [userRows]: any = await pool.query("SELECT COUNT(*) as total FROM users WHERE role = 'user'");
    const [documentRows]: any = await pool.query("SELECT COUNT(*) as total FROM documents WHERE deletedAt IS NULL");
    const [chunkRows]: any = await pool.query("SELECT COUNT(*) as total FROM document_chunks");

    return res.json({
      status: "success",
      data: {
        totalUsers: userRows[0].total,
        totalDatasets: documentRows[0].total,
        totalChunks: chunkRows[0].total,
        activeChats: chatSessions.length,
        totalMessages: chatMessages.length,
        aiTokensUsed: chatMessages.length * 15,
      },
    });
  } catch (error) {
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

    const chatActivities = chatSessions.map((session) => ({
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

    const result = await updateTextDataset(id, { title, sourceUrl, extractedText });

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
    const result = await deleteDocumentById(id);

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
