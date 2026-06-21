import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "User routes aktif.",
    users: [],
  });
});

export default router;