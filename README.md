# SSC ChatBot

SSC ChatBot adalah aplikasi chatbot berbasis web yang dirancang untuk membantu mahasiswa mendapatkan informasi layanan akademik dan administrasi berdasarkan dokumen resmi yang tersedia. Sistem ini menggunakan konsep **document-based chatbot** dengan backend yang membaca dokumen, memecah isi dokumen menjadi chunk, lalu memberikan jawaban sesuai konteks dokumen.

## Project Overview

SSC ChatBot dibuat untuk mendukung layanan Student Service Center dengan fitur utama berupa chatbot yang dapat menjawab pertanyaan mahasiswa berdasarkan dataset dokumen akademik. Chatbot tidak menjawab pertanyaan di luar konteks dokumen yang tersedia.

Project ini disusun dengan struktur fullstack:

```text
ssc-bot/
├── frontend/
├── backend/
├── dataset/
├── package.json
├── .gitignore
└── README.md
```

## Main Features

* Login, register, dan logout admin/user.
* Backend API untuk autentikasi menggunakan JWT.
* Admin CRUD.
* Import dokumen dari folder dataset.
* Upload dokumen PDF, DOC, DOCX, XLS, dan XLSX.
* Ekstraksi teks dari dokumen.
* Pemecahan isi dokumen menjadi chunk.
* Chatbot menjawab berdasarkan konteks dokumen.
* Chatbot menolak pertanyaan di luar konteks dokumen.
* Menampilkan sumber dokumen yang digunakan sebagai referensi jawaban.
* Riwayat chat/session.

## Dataset

Dataset disimpan di folder:

```text
dataset/
```

Dataset berisi dokumen akademik dan administrasi, seperti panduan tugas akhir, panduan pendaftaran sidang, surat keterangan aktif mahasiswa, surat pengantar, persyaratan kelulusan, dan dokumen terkait layanan akademik lainnya.

Backend akan membaca dokumen dari folder dataset, mengekstrak teks, lalu menyimpannya ke memory sebagai data yang digunakan chatbot.

## Tech Stack

### Frontend

* React
* TypeScript
* Vite
* CSS

### Backend

* Node.js
* Express.js
* TypeScript
* JWT Authentication
* Multer
* pdf-parse
* mammoth
* xlsx
* Groq API

## Setup Project

### 1. Clone Repository

```bash
git clone https://github.com/Baihaqi2275/ssc-bot.git
cd ssc-bot
```

### 2. Install Dependencies

Install dependencies root, backend, dan frontend:

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
```

Atau gunakan script:

```bash
npm run install:all
```

## Environment Variables

Buat file `.env` di folder backend:

```text
backend/.env
```

Isi file:

```env
PORT=5000
JWT_SECRET=your_jwt_secret
BASE_URL=http://localhost:5000
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.1-8b-instant
```

File `.env` tidak boleh di-push ke GitHub karena berisi data rahasia.

Contoh konfigurasi tersedia di:

```text
backend/.env.example
```

## Run Project

Jalankan frontend dan backend secara bersamaan dari folder root:

```bash
npm run dev
```

Server akan berjalan pada:

```text
Backend  : http://localhost:5000
Frontend : http://localhost:5173
```

Jika port frontend 5173 sudah digunakan, Vite akan otomatis menggunakan port lain seperti 5174.

## Backend API Endpoints

### Auth

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### Admin

```text
GET    /api/admins
POST   /api/admins
PUT    /api/admins/:id
DELETE /api/admins/:id
```

### Documents

```text
POST /api/documents/import-dataset
POST /api/documents/upload
GET  /api/documents
GET  /api/documents/:id
GET  /api/documents/chunks/all
GET  /api/documents/:id/chunks
DELETE /api/documents/:id
```

### Chat

```text
POST /api/chat/start
POST /api/chat/send
GET  /api/chat/users
GET  /api/chat/sessions/:user_id
GET  /api/chat/messages/:session_id
```

## How SSC ChatBot Works

1. Dokumen akademik dimasukkan ke folder `dataset`.
2. Backend membaca dokumen saat server berjalan.
3. Teks dari dokumen diekstrak sesuai format file.
4. Teks dokumen dipotong menjadi beberapa chunk.
5. Saat user bertanya, backend mencari chunk yang paling relevan.
6. Jawaban dibuat berdasarkan konteks chunk tersebut.
7. Chatbot mengirim jawaban beserta sumber dokumen.
8. Jika pertanyaan tidak sesuai konteks dokumen, chatbot akan menolak atau menyatakan bahwa informasi tidak ditemukan.

## Build Frontend

Masuk ke folder frontend:

```bash
cd frontend
npm run build
```

## Build Backend

Masuk ke folder backend:

```bash
cd backend
npm run build
```

## Security Note

API key Groq dan secret JWT harus disimpan di file `.env` pada backend. Jangan menyimpan API key asli di frontend, README, `.env.example`, atau file lain yang ikut di-push ke GitHub.

File yang tidak boleh di-push:

```text
.env
backend/.env
frontend/.env
node_modules
backend/node_modules
frontend/node_modules
backend/uploads
```

## Project Status

Project ini merupakan final project pengembangan aplikasi AI berbasis chatbot untuk membantu layanan akademik Student Service Center. Backend sudah mendukung autentikasi, pengelolaan dokumen, import dataset, pencarian konteks dokumen, jawaban chatbot berbasis RAG sederhana, dan sumber dokumen.
