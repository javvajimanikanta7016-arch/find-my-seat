// Ticket text extraction: images via on-device Tesseract.js OCR,
// PDFs via pdf.js (native text first, rendered-page OCR fallback).

import { createWorker } from 'tesseract.js';

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf'];

export function validateTicketFile(file: File): { ok: boolean; error?: string } {
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: 'That file is larger than 10 MB. Try a smaller screenshot.' };
  }
  const extOk = ALLOWED_EXT.some((ext) => file.name.toLowerCase().endsWith(ext));
  if (!ALLOWED_TYPES.has(file.type) && !extOk) {
    return { ok: false, error: 'Please upload a JPG, PNG, WebP or PDF ticket.' };
  }
  return { ok: true };
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

/** OCR a single image (object URL or data URL) with Tesseract.js. */
export async function ocrImage(imageSrc: string): Promise<string> {
  let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
  try {
    worker = await createWorker('eng');
  } catch {
    throw new Error(
      "The text reader couldn't load. Check your connection — or enter the seat manually.",
    );
  }
  try {
    const { data } = await worker.recognize(imageSrc);
    return (data?.text ?? '').trim();
  } catch {
    throw new Error("We couldn't read your ticket. Try uploading a clearer image.");
  } finally {
    try {
      await worker.terminate();
    } catch {
      /* ignore */
    }
  }
}

/** Extract text from a PDF: embedded text first, else OCR the rendered page. */
export async function ocrPdf(file: File): Promise<string> {
  let pdfjs: any;
  let workerSrc: string;
  try {
    pdfjs = await import('pdfjs-dist');
    workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default as string;
  } catch {
    throw new Error("We couldn't open that PDF. Try uploading a screenshot instead.");
  }
  try {
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
    const buf = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
    const page = await pdf.getPage(1);

    // 1) Try embedded text (fast + accurate for e-tickets).
    try {
      const content = await page.getTextContent();
      const embedded = (content.items as Array<{ str?: string }>)
        .map((it) => it.str ?? '')
        .join('\n')
        .trim();
      if (embedded.length > 40) return embedded;
    } catch {
      /* fall through to OCR */
    }

    // 2) Render page 1 to a canvas and OCR it.
    const viewport = page.getViewport({ scale: 2.5 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('PDF render failed');
    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL('image/png');
    try {
      await pdf.destroy();
    } catch {
      /* ignore */
    }
    return ocrImage(dataUrl);
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error("We couldn't read that PDF. Try uploading a clearer file.");
  }
}

export type OcrStage = 'reading' | 'ocr' | 'parsing';

export async function extractTicketText(
  file: File,
  onStage?: (stage: OcrStage) => void,
): Promise<string> {
  const validation = validateTicketFile(file);
  if (!validation.ok) throw new Error(validation.error);
  onStage?.('reading');
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (isPdf) {
    onStage?.('ocr');
    return ocrPdf(file);
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    onStage?.('ocr');
    return await ocrImage(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
