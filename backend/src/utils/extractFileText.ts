import { extractPdfText } from "./extractPdf";
import { extractDocxText } from "./extractDocx";
import { extractXlsxText } from "./extractXlsx";
import * as fs from "fs";

function normalizeSingleString(value: unknown): string {
  if (Array.isArray(value)) {
    return value[0] ? String(value[0]) : "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

export async function extractFileText(
  filePathValue: unknown,
  mimetypeValue: unknown
): Promise<string> {
  const filePath = normalizeSingleString(filePathValue);
  const mimetype = normalizeSingleString(mimetypeValue);

  if (!filePath) {
    throw new Error("Path file tidak valid.");
  }

  if (mimetype === "application/pdf") {
    return extractPdfText(filePath);
  }

  if (mimetype === "text/plain" || mimetype === "text/markdown") {
    return fs.promises.readFile(filePath, "utf-8");
  }

  if (
    mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimetype === "application/msword"
  ) {
    return extractDocxText(filePath);
  }

  if (
    mimetype ===
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return extractXlsxText(filePath);
  }

  throw new Error("Format file tidak didukung. Gunakan PDF, DOC, DOCX, atau XLSX.");
}