import { importDatasetFromFolder } from "./src/services/document.service";
import { initDB } from "./src/config/database";

async function run() {
  await initDB();
  const res = await importDatasetFromFolder();
  console.log(res);
  process.exit(0);
}
run();
