import dotenv from "dotenv";

dotenv.config();

import app from "./app";
import { initDB } from "./config/database";

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  await initDB();
  console.log(`Server berjalan di http://localhost:${PORT}`);
  console.log(`Groq key loaded: ${process.env.GROQ_API_KEY ? "YA" : "TIDAK"}`);
});