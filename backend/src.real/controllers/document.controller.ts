import { Request, Response } from "express";
import {
  deleteDocumentById,
  getAllDocuments,
  processUploadedDocument,
} from "../services/document.service";

export async function uploadDocument(req: Request, res: Response) {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "File tidak ditemukan.",
      });
    }

    const result = await processUploadedDocument(file);

    return res.status(201).json({
      success: true,
      message: "Dokumen berhasil diunggah dan diproses.",
      document: result.document,
      totalChunks: result.totalChunks,
    });
  } catch (error: any) {
    console.error("Upload document error:", error);

    return res.status(500).json({
      success: false,
      message: error?.message || "Gagal memproses dokumen.",
    });
  }
}

export async function getDocuments(_req: Request, res: Response) {
  try {
    const documents = await getAllDocuments();

    return res.status(200).json({
      success: true,
      documents,
    });
  } catch (error) {
    console.error("Get documents error:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil data dokumen.",
    });
  }
}

export async function deleteDocument(req: Request, res: Response) {
  try {
    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : String(idParam);

    const result = await deleteDocumentById(id);

    if (!result.deleted) {
      return res.status(404).json({
        success: false,
        message: result.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("Delete document error:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal menghapus dokumen.",
    });
  }

}
import { importDatasetFromFolder } from "../services/document.service";

export async function importDataset(req: Request, res: Response) {
  try {
    const result = await importDatasetFromFolder();
    
    return res.status(200).json({
      success: true,
      message: "Dataset import completed",
      ...result
    });
  } catch (error: any) {
    console.error("Import dataset error:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to import dataset",
    });
  }
}