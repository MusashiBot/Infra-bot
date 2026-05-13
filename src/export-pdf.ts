import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { parseArg } from "./utils.js";

function assertArg(value: string | null, flag: string): string {
  if (!value) {
    throw new Error(`Missing ${flag}`);
  }

  return value;
}

function ensureParentDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeWrappedLine(
  doc: PDFKit.PDFDocument,
  line: string,
  options?: PDFKit.Mixins.TextOptions,
): void {
  doc.text(line, options);
  doc.moveDown(0.25);
}

function renderMarkdownToPdf(
  markdown: string,
  outputPath: string,
): Promise<void> {
  ensureParentDir(outputPath);

  return new Promise((resolve, reject) => {
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

    const stream = fs.createWriteStream(outputPath);
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
  const inputPath = path.resolve(
    assertArg(parseArg(args, "--input"), "--input"),
  );
  const outputPath = path.resolve(
    parseArg(args, "--output") ??
      inputPath.replace(/\.md$/i, ".pdf").replace(/\/outputs\//, "/outputs/"),
  );

  const markdown = await fs.promises.readFile(inputPath, "utf8");
  await renderMarkdownToPdf(markdown, outputPath);

  console.log(
    JSON.stringify(
      {
        ok: true,
        input: inputPath,
        output: outputPath,
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
