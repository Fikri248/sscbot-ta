import { Router } from "express";
import {
  createAdmin,
  deleteAdmin,
  getAdminById,
  getAllAdmins,
  getNotifications,
  getDashboardStats,
  getDatasetList,
  createDataset,
  updateDataset,
  deleteDataset,
  syncDataset,
  getSyncStatus,
  updateAdmin,
  getDocumentText,
  getDocumentChunksById,
  getScrapedData,
  queryTestRag,
  updateDocumentChunk,
} from "../controllers/admin.controller";
import { authMiddleware, requireAdmin } from "../middlewares/auth.middleware";

const router = Router();

router.use(authMiddleware, requireAdmin);

router.get("/notifications", getNotifications);
router.get("/stats", getDashboardStats);

router.get("/admins", getAllAdmins);
router.get("/admins/:id", getAdminById);
router.post("/admins", createAdmin);
router.put("/admins/:id", updateAdmin);
router.delete("/admins/:id", deleteAdmin);

router.get("/datasets", getDatasetList);
router.post("/datasets", createDataset);
router.put("/datasets/:id", updateDataset);
router.delete("/datasets/:id", deleteDataset);

router.post("/sync", syncDataset);
router.get("/sync/status", getSyncStatus);

// KB Management Endpoints
router.get("/documents/:id/text", getDocumentText);
router.get("/documents/:id/chunks", getDocumentChunksById);
router.put("/chunks/:id", updateDocumentChunk);
router.get("/scraped-data", getScrapedData);
router.post("/rag/query-test", queryTestRag);

router.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Admin routes aktif dan terlindungi token admin.",
  });
});

export default router;
