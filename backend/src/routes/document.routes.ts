import { Router } from "express";
import {
  deleteDocument,
  getDocuments,
  importDataset,
  uploadDocument,
} from "../controllers/document.controller";
import { upload } from "../middlewares/upload.middleware";

const router = Router();

router.get("/", getDocuments);
router.get("/import-dataset", importDataset);
router.post("/import-dataset", importDataset);
router.post("/upload", upload.single("file"), uploadDocument);
router.delete("/:id", deleteDocument);

export default router;