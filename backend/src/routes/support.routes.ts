import { Router } from "express";
import {
  createSupportRequest,
  getSupportRequestById,
  getSupportRequests,
  sendSupportMessage,
} from "../controllers/support.controller";

const router = Router();

router.post("/requests", createSupportRequest);
router.get("/requests", getSupportRequests);
router.get("/requests/:id", getSupportRequestById);
router.post("/requests/:id/messages", sendSupportMessage);

export default router;