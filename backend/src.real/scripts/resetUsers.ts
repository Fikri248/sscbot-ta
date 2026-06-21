import { pool } from "../config/database";

async function run() {
  try {
    const [result]: any = await pool.query("DELETE FROM users WHERE role = 'user'");
    console.log(`Berhasil menghapus ${result.affectedRows} akun mahasiswa dari database.`);
  } catch (error) {
    console.error("Gagal mereset database:", error);
  } finally {
    process.exit(0);
  }
}

run();
