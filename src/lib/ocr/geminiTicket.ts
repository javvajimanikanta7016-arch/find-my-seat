import type { TicketDraft } from '../../types';
import { supabase } from '../supabase/client';

type GeminiTicketResponse = {
  movie?: unknown;
  theatre?: unknown;
  screen?: unknown;
  showTime?: unknown;
  row?: unknown;
  seat?: unknown;
  platform?: unknown;
  uncertainFields?: unknown;
  source?: unknown;
  error?: unknown;
};

const PLATFORMS = ['BookMyShow', 'District', 'Paytm Movies', 'TicketNew', 'Other'];

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 120) : '';
}

function fileMimeType(file: File): string {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.gif')) return 'image/gif';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

/**
 * Send a ticket to the authenticated Supabase Edge Function.
 * The Gemini API key stays on the server; it is never sent to the browser.
 */
export async function extractTicketWithGemini(
  file: File,
): Promise<{ draft: Omit<TicketDraft, 'fileName' | 'fileDataUrl'>; uncertainFields: string[] }> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const mimeType = fileMimeType(file);
  if (mimeType === 'application/octet-stream') {
    throw new Error('This ticket file type is not supported.');
  }

  const uploadFile =
    file.type === mimeType ? file : new File([file], file.name, { type: mimeType });

  const formData = new FormData();
  formData.append('file', uploadFile, uploadFile.name);

  const { data, error } = await supabase.functions.invoke<GeminiTicketResponse>(
    'extract-ticket',
    { body: formData },
  );

  if (error) {
    throw new Error(error.message || 'The Gemini ticket reader is unavailable.');
  }
  if (!data || typeof data !== 'object') {
    throw new Error('The Gemini ticket reader returned an empty response.');
  }
  if (typeof data.error === 'string') {
    throw new Error(data.error);
  }

  const movie = asText(data.movie);
  const theatre = asText(data.theatre);
  const screen = asText(data.screen);
  const showTime = asText(data.showTime);
  const row = asText(data.row).toUpperCase();
  const seat = asText(data.seat);
  const platform = PLATFORMS.includes(String(data.platform))
    ? String(data.platform)
    : 'Other';

  const uncertainFields = Array.isArray(data.uncertainFields)
    ? data.uncertainFields.filter((field): field is string => typeof field === 'string')
    : [];

  if (![movie, theatre, screen, showTime, row, seat].some(Boolean)) {
    throw new Error('Gemini could not find readable ticket details.');
  }

  // This is a simple field-completeness score, not a probability from Gemini.
  let confidence = 0;
  if (row && seat) confidence += 40;
  else if (row || seat) confidence += 15;
  if (screen) confidence += 20;
  if (theatre) confidence += 15;
  if (movie) confidence += 15;
  if (showTime) confidence += 10;
  confidence = Math.max(0, Math.min(100, confidence - uncertainFields.length * 8));

  const level: TicketDraft['level'] =
    confidence >= 75 ? 'high' : confidence >= 45 ? 'medium' : 'low';

  return {
    draft: {
      movie,
      theatre,
      screen,
      showTime,
      row,
      seat,
      platform,
      confidence,
      level,
      rawText: '',
    },
    uncertainFields,
  };
}
