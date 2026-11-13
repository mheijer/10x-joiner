// POST /api/profile/extract  (multipart form, field "file": PDF, DOCX or TXT, up to 5 MB)
// Turns a résumé or cover letter into plain text. No AI call and nothing stored: the text goes back to the browser,
// the user sees and can edit it, and only the text (never the file) is saved with their profile.
import { NextResponse } from "next/server";

export const maxDuration = 30;
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File is over 5 MB" }, { status: 413 });

  const name = file.name.toLowerCase();
  const buf = new Uint8Array(await file.arrayBuffer());
  try {
    let text = "";
    if (name.endsWith(".pdf") || file.type === "application/pdf") {
      const unpdf: any = await import("unpdf");
      const pdf = await unpdf.getDocumentProxy(buf);
      const out = await unpdf.extractText(pdf, { mergePages: true });
      text = Array.isArray(out.text) ? out.text.join("\n") : String(out.text ?? "");
    } else if (name.endsWith(".docx")) {
      const mod: any = await import("mammoth");
      const mammoth = mod.extractRawText ? mod : mod.default;
      const out = await mammoth.extractRawText({ buffer: Buffer.from(buf) });
      text = String(out.value ?? "");
    } else if (name.endsWith(".txt") || name.endsWith(".md") || file.type.startsWith("text/")) {
      text = new TextDecoder().decode(buf);
    } else {
      return NextResponse.json({ error: "Upload a PDF, Word (.docx) or text file" }, { status: 415 });
    }
    text = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    if (!text) return NextResponse.json({ error: "No text found in that file (is it a scanned image?)" }, { status: 422 });
    return NextResponse.json({ text: text.slice(0, 20000), truncated: text.length > 20000 });
  } catch (e: any) {
    return NextResponse.json({ error: `Couldn't read that file: ${e.message}` }, { status: 500 });
  }
}
