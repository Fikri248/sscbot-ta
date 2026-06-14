import dotenv from "dotenv";

dotenv.config();

import app from "./app";

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
  console.log(`Groq key loaded: ${process.env.GROQ_API_KEY ? "YA" : "TIDAK"}`);
});