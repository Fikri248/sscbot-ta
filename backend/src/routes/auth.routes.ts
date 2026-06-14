import { Router } from "express";

const router = Router();

router.post("/register", (req, res) => {
  const { name, email } = req.body;

  res.status(201).json({
    success: true,
    message: "Register sementara berhasil.",
    user: {
      id: Date.now().toString(),
      name,
      email,
      role: "user",
    },
  });
});

router.post("/login", (req, res) => {
  const { email } = req.body;

  res.status(200).json({
    success: true,
    message: "Login sementara berhasil.",
    token: "temporary-token",
    user: {
      id: Date.now().toString(),
      email,
      role: "user",
    },
  });
});

router.post("/logout", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Logout berhasil.",
  });
});

router.get("/me", (_req, res) => {
  res.status(200).json({
    success: true,
    user: {
      id: "1",
      name: "User",
      email: "user@gmail.com",
      role: "user",
    },
  });
});

export default router;