import { Request, Response } from "express";

type SupportRequest = {
  id: string;
  name: string;
  nim: string;
  prodi: string;
  phone: string;
  problem?: string;
  status: "open" | "closed";
  createdAt: string;
  messages: {
    id: string;
    sender: "user" | "admin";
    text: string;
    createdAt: string;
  }[];
};

const supportRequests: SupportRequest[] = [];

export async function createSupportRequest(req: Request, res: Response) {
  try {
    const { name, nim, prodi, phone, problem } = req.body;

    if (!name || !nim || !prodi || !phone) {
      return res.status(400).json({
        success: false,
        message: "Nama, NIM, prodi, dan nomor telepon wajib diisi.",
      });
    }

    const newRequest: SupportRequest = {
      id: Date.now().toString(),
      name,
      nim,
      prodi,
      phone,
      problem: problem || "",
      status: "open",
      createdAt: new Date().toISOString(),
      messages: problem
        ? [
            {
              id: `${Date.now()}-msg`,
              sender: "user",
              text: problem,
              createdAt: new Date().toISOString(),
            },
          ]
        : [],
    };

    supportRequests.push(newRequest);

    return res.status(201).json({
      success: true,
      message: "Data berhasil dikirim. Kamu akan diarahkan ke halaman pesan admin.",
      request: newRequest,
    });
  } catch (error) {
    console.error("Create support request error:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal membuat permintaan bantuan admin.",
    });
  }
}

export async function getSupportRequests(_req: Request, res: Response) {
  return res.status(200).json({
    success: true,
    requests: supportRequests,
  });
}

export async function getSupportRequestById(req: Request, res: Response) {
  const { id } = req.params;

  const request = supportRequests.find((item) => item.id === id);

  if (!request) {
    return res.status(404).json({
      success: false,
      message: "Permintaan bantuan tidak ditemukan.",
    });
  }

  return res.status(200).json({
    success: true,
    request,
  });
}

export async function sendSupportMessage(req: Request, res: Response) {
  const { id } = req.params;
  const { sender, text } = req.body;

  const request = supportRequests.find((item) => item.id === id);

  if (!request) {
    return res.status(404).json({
      success: false,
      message: "Permintaan bantuan tidak ditemukan.",
    });
  }

  if (!text || !sender) {
    return res.status(400).json({
      success: false,
      message: "Sender dan pesan wajib diisi.",
    });
  }

  const newMessage = {
    id: Date.now().toString(),
    sender: sender === "admin" ? "admin" as const : "user" as const,
    text,
    createdAt: new Date().toISOString(),
  };

  request.messages.push(newMessage);

  return res.status(201).json({
    success: true,
    message: "Pesan berhasil dikirim.",
    data: newMessage,
  });
}