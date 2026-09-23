import { AlertTriangle, Camera, FileImage, Loader2, PencilLine, Sparkles } from 'lucide-react';
import { useRef, useState } from 'react';
import type { TicketDraft } from '../types';
import { SAMPLE_TICKET_TEXT } from '../lib/data/sampleTheatre';
import { extractTicketText, fileToDataUrl, type OcrStage } from '../lib/ocr/ticketOcr';
import { parseTicketText } from '../lib/ocr/ticketParser';
import { useApp } from '../lib/store/appStore';

export function emptyDraft(): TicketDraft {
  return {
    movie: '',
    theatre: '',
    screen: '',
    showTime: '',
    row: '',
    seat: '',
    platform: 'Other',
    confidence: 0,
    level: 'low',
    rawText: '',
  };
}

const STAGE_LABEL: Record<OcrStage, string> = {
  reading: 'Reading file…',
  ocr: 'Reading ticket text… (takes a few seconds)',
  parsing: 'Understanding ticket…',
};

export function TicketUploader() {
  const { setDraft, setPendingFile, go, notify, uploadMode } = useApp();
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file || busy) return;
    setError('');
    setBusy(true);
    setStage('Reading file…');
    try {
      const dataUrl = file.type.startsWith('image/') ? await fileToDataUrl(file) : null;
      setPreview(dataUrl);
      const text = await extractTicketText(file, (s) => setStage(STAGE_LABEL[s]));
      setStage('Understanding ticket…');
      if (!text || text.trim().length < 10) {
        throw new Error("We couldn't read your ticket. Try uploading a clearer image.");
      }
      const parsed = parseTicketText(text);
      setDraft({ ...parsed, fileName: file.name, fileDataUrl: dataUrl ?? undefined });
      setPendingFile(file);
      go('confirm');
      if (!parsed.row || !parsed.seat) {
        notify("We couldn't identify your seat. Please enter it manually.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong reading that file.');
    } finally {
      setBusy(false);
      setStage('');
    }
  };

  const useSample = () => {
    if (busy) return;
    const parsed = parseTicketText(SAMPLE_TICKET_TEXT);
    setDraft({ ...parsed, fileName: 'sample-ticket' });
    setPendingFile(null);
    go('confirm');
  };

  const enterManually = () => {
    if (busy) return;
    setDraft(emptyDraft());
    setPendingFile(null);
    go('confirm');
  };

  return (
    <div className="space-y-3">
      {preview && (
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <img src={preview} alt="Uploaded ticket" className="max-h-56 w-full object-contain bg-black" />
        </div>
      )}

      {busy && (
        <div className="card flex items-center gap-3 border-gold-400/30">
          <Loader2 size={22} className="animate-spin text-gold-400" />
          <div>
            <p className="text-sm font-bold">Scanning your ticket…</p>
            <p className="text-xs text-zinc-400">{stage || 'Working…'}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="card space-y-3 border-red-500/30 bg-red-500/5">
          <div className="flex items-start gap-2 text-sm text-red-200">
            <AlertTriangle size={17} className="mt-0.5 shrink-0" />
            {error}
          </div>
          <button onClick={enterManually} className="btn-secondary !py-2.5 text-sm">
            <PencilLine size={17} /> Enter details manually
          </button>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*,.pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      <button onClick={() => fileRef.current?.click()} className="btn-primary" disabled={busy}>
        <FileImage size={20} /> Upload Ticket
      </button>
      <button
        onClick={() => cameraRef.current?.click()}
        className={`btn-secondary ${uploadMode === 'camera' ? '!border-gold-400/50 !bg-gold-400/10' : ''}`}
        disabled={busy}
      >
        <Camera size={20} /> Scan with Camera
      </button>

      <div className="flex items-center gap-3 py-1 text-xs font-semibold uppercase tracking-widest text-zinc-500">
        <span className="h-px flex-1 bg-white/10" /> or <span className="h-px flex-1 bg-white/10" />
      </div>

      <button onClick={useSample} className="btn-secondary" disabled={busy}>
        <Sparkles size={19} /> Use sample ticket
      </button>
      <button onClick={enterManually} className="btn-ghost w-full" disabled={busy}>
        <PencilLine size={16} /> Enter details manually
      </button>

      <p className="text-center text-xs leading-relaxed text-zinc-500">
        JPG, PNG, WebP or PDF up to 10 MB.
        <br />
        Works with BookMyShow, District and most e-tickets.
      </p>
    </div>
  );
}
