import { Router } from "express";
import {
  getNotifications,
  getDashboardStats,
  getDatasetList,
  createDataset,
  updateDataset,
  deleteDataset,
  syncDataset,
  getSyncStatus,
} from "../controllers/admin.controller";

const router = Router();

router.get("/notifications", getNotifications);
router.get("/stats", getDashboardStats);

router.get("/datasets", getDatasetList);
router.post("/datasets", createDataset);
router.put("/datasets/:id", updateDataset);
router.delete("/datasets/:id", deleteDataset);

router.post("/sync", syncDataset);
router.get("/sync/status", getSyncStatus);

router.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Admin routes aktif.",
  });
});

export default router;