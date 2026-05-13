import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import { getEnv } from "./config.js";
import { parseArg, todaySlug } from "./utils.js";

async function ensureParentDir(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

function writeWrappedLine(
  doc: PDFKit.PDFDocument,
  line: string,
  options?: PDFKit.Mixins.TextOptions,
): void {
  doc.text(line, options);
  doc.moveDown(0.25);
}

async function renderMarkdownToPdf(
  markdown: string,
  outputPath: string,
): Promise<void> {
  await ensureParentDir(outputPath);

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: {
        top: 54,
        bottom: 54,
        left: 54,
        right: 54,
      },
      info: {
        Title: path.basename(outputPath, ".pdf"),
        Author: "Musashi Infra Bot",
      },
    });

    const stream = createWriteStream(outputPath);
    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.on("error", reject);
    doc.pipe(stream);

    const lines = markdown.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trimEnd();

      if (line.trim() === "") {
        doc.moveDown(0.4);
        continue;
      }

      if (line.startsWith("# ")) {
        doc.font("Helvetica-Bold").fontSize(20);
        writeWrappedLine(doc, line.slice(2));
        doc.moveDown(0.2);
        continue;
      }

      if (line.startsWith("## ")) {
        doc.font("Helvetica-Bold").fontSize(15);
        writeWrappedLine(doc, line.slice(3));
        doc.moveDown(0.1);
        continue;
      }

      if (/^\d+\.\s/.test(line)) {
        doc.font("Helvetica").fontSize(10.5);
        writeWrappedLine(doc, line, { indent: 14 });
        continue;
      }

      if (line.startsWith("- ")) {
        doc.font("Helvetica").fontSize(10.5);
        writeWrappedLine(doc, `• ${line.slice(2)}`, { indent: 10 });
        continue;
      }

      doc.font("Helvetica").fontSize(11);
      writeWrappedLine(doc, line);
    }

    doc.end();
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const env = getEnv();
  const date = parseArg(args, "--date") ?? todaySlug();
  const dateDir = path.resolve(env.OUTPUT_DIR, date);
  const pdfDir = path.join(dateDir, "pdf");

  const entries = await fs.readdir(dateDir, { withFileTypes: true });
  const markdownFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort();

  if (markdownFiles.length === 0) {
    throw new Error(`No markdown reports found in ${dateDir}`);
  }

  const written: Array<{ input: string; output: string }> = [];
  for (const fileName of markdownFiles) {
    const inputPath = path.join(dateDir, fileName);
    const outputPath = path.join(pdfDir, fileName.replace(/\.md$/i, ".pdf"));
    const markdown = await fs.readFile(inputPath, "utf8");
    await renderMarkdownToPdf(markdown, outputPath);
    written.push({ input: inputPath, output: outputPath });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        date,
        written,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
