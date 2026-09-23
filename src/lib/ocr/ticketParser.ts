// Parses raw OCR text from a movie ticket into structured fields.
// Works with BookMyShow / District style tickets without any private APIs.

import type { TicketDraft } from '../../types';

const MONTHS = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec';

function cleanLine(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function detectPlatform(text: string): string {
  if (/bookmyshow|\bbms\b/i.test(text)) return 'BookMyShow';
  if (/district/i.test(text)) return 'District';
  if (/paytm/i.test(text)) return 'Paytm Movies';
  if (/ticketnew/i.test(text)) return 'TicketNew';
  return 'Other';
}

function extractLabeled(text: string, labels: string[]): string {
  for (const label of labels) {
    const re = new RegExp(`${label}\\s*[:\\-]\\s*(.+?)(?:\\n|$)`, 'i');
    const m = text.match(re);
    if (m?.[1]) {
      const v = cleanLine(m[1]);
      if (v && v.length <= 80) return v;
    }
  }
  return '';
}

function extractTheatre(text: string, lines: string[]): string {
  const labeled = extractLabeled(text, ['theatre', 'theater', 'cinema', 'venue']);
  if (labeled) return labeled;
  const venueRe = /(PVR|INOX|CINEPOLIS|MIRAJ|PRASADS|ASIAN|AMB\b|CINE|CINEMA|MALL|MULTIPLEX|PICTURE|MOVIE)/i;
  for (const line of lines) {
    if (venueRe.test(line) && line.length <= 70 && !/screen|seat|row|ticket|booking/i.test(line)) {
      return cleanLine(line);
    }
  }
  return '';
}

function extractScreen(text: string): string {
  const patterns = [
    /screen\s*(?:no\.?|number|#)?\s*(\d{1,2}|[A-Z])/i,
    /scr\.?\s*(\d{1,2})/i,
    /audi(?:torium)?\s*(?:no\.?)?\s*(\d{1,2})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].toUpperCase();
  }
  return '';
}

function extractShowTime(text: string): string {
  const time = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/)?.[1] ?? '';
  const date =
    text.match(new RegExp(`((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,?\\s*)?\\d{1,2}\\s+(?:${MONTHS})[a-z]*\\s*\\d{0,4}`, 'i'))?.[0] ??
    '';
  return [date.trim(), time.trim()].filter(Boolean).join(' | ');
}

function extractSeat(text: string): { row: string; seat: string } {
  const patterns: RegExp[] = [
    /row\s*([A-Z]{1,2})\s*[^A-Z0-9]{0,6}seat\s*(\d{1,2})/i,
    /seats?(?:\s*(?:no|number))?\s*[:\-]?\s*([A-Z]{1,2})\s*[-– ]?\s*(\d{1,2})/i,
    /\b([A-Z]{1,2})\s*[-–]\s*(\d{1,2})\b/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1] && m?.[2]) return { row: m[1].toUpperCase(), seat: m[2] };
  }
  // Fallback: find a compact code like G18 on a line mentioning seat/row.
  for (const line of text.split('\n')) {
    if (/seat|row/i.test(line)) {
      const m = line.match(/\b([A-Z])\s?(\d{1,2})\b/);
      if (m) return { row: m[1].toUpperCase(), seat: m[2] };
    }
  }
  return { row: '', seat: '' };
}

function extractMovie(text: string, lines: string[]): string {
  const labeled = extractLabeled(text, ['movie', 'film', 'show']);
  if (labeled) return labeled;
  const skip =
    /bookmyshow|district|paytm|ticket|booking|screen|audi|seat|row|theatre|theater|cinema|mall|multiplex|inox|\bpvr\b|am\b|pm\b|\d:\d{2}|mon|tue|wed|thu|fri|sat|sun|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|m-ticket|e-ticket|cancellation|refund|valid|entry|gate|gold|silver|platinum|recliner|2d|3d|imax|4dx/i;
  const candidates = lines.filter(
    (l) => l.length >= 3 && l.length <= 70 && /[A-Za-z]{2,}/.test(l) && !skip.test(l),
  );
  return candidates[0] ?? '';
}

export function parseTicketText(rawText: string): Omit<TicketDraft, 'fileName' | 'fileDataUrl'> {
  const text = rawText.replace(/\r/g, '');
  const lines = text
    .split('\n')
    .map(cleanLine)
    .filter((l) => l.length > 0);

  const platform = detectPlatform(text);
  const movie = extractMovie(text, lines);
  const theatre = extractTheatre(text, lines);
  const screen = extractScreen(text);
  const showTime = extractShowTime(text);
  const { row, seat } = extractSeat(text);

  let confidence = 0;
  if (row && seat) confidence += 40;
  else if (row || seat) confidence += 15;
  if (screen) confidence += 20;
  if (theatre) confidence += 15;
  if (movie) confidence += 15;
  if (showTime) confidence += 10;
  confidence = Math.min(100, confidence);

  const level: TicketDraft['level'] = confidence >= 75 ? 'high' : confidence >= 45 ? 'medium' : 'low';

  return { movie, theatre, screen, showTime, row, seat, platform, confidence, level, rawText: rawText.trim() };
}
