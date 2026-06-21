import { Router } from "express";
import {
  clearChatHistory,
  getChatHistory,
  sendChatMessage,
  startChatSession,
} from "../controllers/chat.controller";

const router = Router();

router.get("/start", startChatSession);
router.post("/start", startChatSession);
router.post("/send", sendChatMessage);
router.get("/history", getChatHistory);
router.delete("/history", clearChatHistory);

export default router;