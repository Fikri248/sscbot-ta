import xlsx from "xlsx";

export async function extractXlsxText(filePath: string): Promise<string> {
  const workbook = xlsx.readFile(filePath);
  const texts: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];

    const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
    });

    texts.push(`Nama Sheet: ${sheetName}`);

    rows.forEach((row, index) => {
      const rowText = Object.entries(row)
        .map(([key, value]) => `${key}: ${String(value)}`)
        .join(" | ");

      if (rowText.trim()) {
        texts.push(`Baris ${index + 1}: ${rowText}`);
      }
    });
  }

  return texts.join("\n");
}