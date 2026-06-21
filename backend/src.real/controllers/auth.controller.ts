import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { AuthRequest } from "../middlewares/auth.middleware";
import { pool } from "../config/database";

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;
    const role = "user";

    if (!name || !email || !password) {
      return res.status(400).json({
        status: "error",
        message: "Nama, email, dan password wajib diisi",
      });
    }

    const [existing]: any = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({
        status: "error",
        message: "Email sudah terdaftar",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = Date.now().toString();

    await pool.query(
      'INSERT INTO users (id, name, email, passwordHash, role, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, email, passwordHash, role, new Date().toISOString()]
    );

    return res.status(201).json({
      status: "success",
      message: "Register berhasil",
      data: { id, name, email, role },
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Terjadi kesalahan server",
    });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: "error",
        message: "Email dan password wajib diisi",
      });
    }

    const [rows]: any = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "User tidak ditemukan",
      });
    }

    const user = rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        status: "error",
        message: "Password salah",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "1d" }
    );

    return res.json({
      status: "success",
      message: "Login berhasil",
      token,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Terjadi kesalahan server",
    });
  }
};

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    return res.json({
      status: "success",
      message: "Profil berhasil diambil",
      data: req.user,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Terjadi kesalahan server",
    });
  }
};

export const logout = async (req: Request, res: Response) => {
  return res.json({
    status: "success",
    message: "Logout berhasil. Silakan hapus token di frontend.",
  });
};