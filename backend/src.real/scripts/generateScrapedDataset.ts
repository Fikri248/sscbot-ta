import { importDatasetToScrapedFile } from "../services/scrapedDataset.service";

async function main() {
  console.log("Starting scrape...");
  const result = await importDatasetToScrapedFile();
  console.log("Result:", result);
}

main().catch(console.error);
