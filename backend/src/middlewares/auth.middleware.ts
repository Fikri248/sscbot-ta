import { NextFunction, Request, Response } from "express";

export type AuthRequest = Request & {
  user?: {
    id: string;
    email: string;
    role: "user" | "admin";
  };
};

export function authMiddleware(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) {
  req.user = {
    id: "temporary-user-id",
    email: "user@gmail.com",
    role: "admin",
  };

  next();
}

export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Akses ditolak. Hanya admin yang diperbolehkan.",
    });
  }

  next();
}