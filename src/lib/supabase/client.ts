// Supabase client + data layer.
// When VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set, everything talks to
// Supabase (Postgres, Auth, Storage). Otherwise the app runs in demo mode with
// a local sample venue + localStorage-backed tickets (fully functional offline).

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  AdminKind,
  AppUser,
  NavEdge,
  NavPoint,
  Screen,
  Seat,
  Theatre,
  TicketListItem,
} from '../../types';
import {
  SAMPLE_NAV_EDGES,
  SAMPLE_NAV_POINTS,
  SAMPLE_SCREENS,
  SAMPLE_THEATRE,
  buildSampleSeats,
} from '../data/sampleTheatre';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || '';
const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || '';

export const isSupabaseConfigured = Boolean(url && anon);
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anon)
  : null;

// ---------------------------------------------------------------------------
// Demo-mode local stores
// ---------------------------------------------------------------------------

export interface DemoVenue {
  theatres: Theatre[];
  screens: Screen[];
  seats: Seat[];
  points: NavPoint[];
  edges: NavEdge[];
}

const DEMO_VENUE_KEY = 'fms_demo_venue_v1';
const DEMO_TICKETS_KEY = 'fms_demo_tickets_v1';
const DEMO_USER_KEY = 'fms_demo_user_v1';

function freshDemoVenue(): DemoVenue {
  return {
    theatres: [{ ...SAMPLE_THEATRE }],
    screens: SAMPLE_SCREENS.map((s) => ({ ...s })),
    seats: buildSampleSeats(SAMPLE_SCREENS[0].id),
    points: SAMPLE_NAV_POINTS.map((p) => ({ ...p })),
    edges: SAMPLE_NAV_EDGES.map((e) => ({ ...e })),
  };
}

export function loadDemoVenue(): DemoVenue {
  try {
    const raw = localStorage.getItem(DEMO_VENUE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoVenue;
      if (parsed?.theatres?.length) return parsed;
    }
  } catch {
    /* corrupted → reseed below */
  }
  const fresh = freshDemoVenue();
  try {
    localStorage.setItem(DEMO_VENUE_KEY, JSON.stringify(fresh));
  } catch {
    /* private mode */
  }
  return fresh;
}

export function saveDemoVenue(venue: DemoVenue): void {
  try {
    localStorage.setItem(DEMO_VENUE_KEY, JSON.stringify(venue));
  } catch {
    /* ignore */
  }
}

export function resetDemoVenue(): DemoVenue {
  try {
    localStorage.removeItem(DEMO_VENUE_KEY);
  } catch {
    /* ignore */
  }
  return loadDemoVenue();
}

interface DemoTicketRow extends TicketListItem {
  userId: string;
}

function loadDemoTickets(): DemoTicketRow[] {
  try {
    const raw = localStorage.getItem(DEMO_TICKETS_KEY);
    if (raw) return JSON.parse(raw) as DemoTicketRow[];
  } catch {
    /* ignore */
  }
  return [];
}

function saveDemoTickets(rows: DemoTicketRow[]): void {
  try {
    localStorage.setItem(DEMO_TICKETS_KEY, JSON.stringify(rows));
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function ensureProfile(input: {
  id: string;
  email: string;
  name?: string;
}): Promise<AppUser> {
  if (!supabase) return { ...input, role: 'user', isDemo: true };
  const { data } = await supabase
    .from('users')
    .select('id,name,email,role')
    .eq('id', input.id)
    .maybeSingle();
  if (data) {
    return {
      id: data.id,
      email: data.email ?? input.email,
      name: data.name ?? input.name,
      role: data.role === 'admin' ? 'admin' : 'user',
    };
  }
  const { data: created, error } = await supabase
    .from('users')
    .insert({ id: input.id, email: input.email, name: input.name ?? null })
    .select('id,name,email,role')
    .single();
  if (error || !created) {
    return { id: input.id, email: input.email, name: input.name, role: 'user' };
  }
  return {
    id: created.id,
    email: created.email ?? input.email,
    name: created.name ?? input.name,
    role: created.role === 'admin' ? 'admin' : 'user',
  };
}

export async function getSessionUser(): Promise<AppUser | null> {
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const u = data.session?.user;
    if (!u) return null;
    return ensureProfile({
      id: u.id,
      email: u.email ?? '',
      name: (u.user_metadata?.full_name as string | undefined) ?? undefined,
    });
  }
  try {
    const raw = localStorage.getItem(DEMO_USER_KEY);
    return raw ? (JSON.parse(raw) as AppUser) : null;
  } catch {
    return null;
  }
}

export async function signUpWithPassword(
  email: string,
  password: string,
  name?: string,
): Promise<AppUser> {
  if (!supabase) throw new Error('Supabase is not connected. Use “Continue as demo” instead.');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name ?? '' } },
  });
  if (error) throw error;
  if (!data.user) {
    throw new Error('Account created — check your email to confirm, then sign in.');
  }
  return ensureProfile({ id: data.user.id, email, name });
}

export async function signInWithPassword(email: string, password: string): Promise<AppUser> {
  if (!supabase) throw new Error('Supabase is not connected. Use “Continue as demo” instead.');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.user) throw new Error('Could not sign you in. Please try again.');
  return ensureProfile({
    id: data.user.id,
    email: data.user.email ?? email,
    name: (data.user.user_metadata?.full_name as string | undefined) ?? undefined,
  });
}

export async function signInWithGoogle(): Promise<void> {
  if (!supabase) throw new Error('Supabase is not connected. Use “Continue as demo” instead.');
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signOutEverywhere(): Promise<void> {
  if (supabase) {
    await supabase.auth.signOut();
  }
  try {
    localStorage.removeItem(DEMO_USER_KEY);
  } catch {
    /* ignore */
  }
}

export function demoSignIn(email = 'demo@findmyseat.app'): AppUser {
  const allowList = (
    ((import.meta.env.VITE_DEMO_ADMINS as string | undefined) || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
  );
  const lower = email.toLowerCase();
  const role = lower.includes('admin') || allowList.includes(lower) ? 'admin' : 'user';
  const user: AppUser = {
    id: `demo-${Math.random().toString(36).slice(2, 10)}`,
    email,
    name: role === 'admin' ? 'Demo Admin' : 'Demo User',
    role,
    isDemo: true,
  };
  try {
    localStorage.setItem(DEMO_USER_KEY, JSON.stringify(user));
  } catch {
    /* ignore */
  }
  return user;
}

// ---------------------------------------------------------------------------
// Venue data
// ---------------------------------------------------------------------------

export async function fetchTheatres(): Promise<Theatre[]> {
  if (supabase) {
    const { data, error } = await supabase.from('theatres').select('*').order('name');
    if (!error && data) return data as Theatre[];
  }
  return loadDemoVenue().theatres;
}

function wordScore(query: string, target: string): number {
  const q = query.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const t = new Set(target.toLowerCase().split(/[^a-z0-9]+/));
  return q.filter((w) => t.has(w)).length;
}

export async function matchTheatreByName(name: string): Promise<Theatre | null> {
  const q = name.trim();
  if (!q) return null;
  if (supabase) {
    const direct = await supabase.from('theatres').select('*').ilike('name', `%${q}%`).limit(1);
    if (direct.data?.[0]) return direct.data[0] as Theatre;
    const words = q.split(/\s+/).filter((w) => w.length > 3);
    for (const w of words.slice(0, 3)) {
      const r = await supabase.from('theatres').select('*').ilike('name', `%${w}%`).limit(1);
      if (r.data?.[0]) return r.data[0] as Theatre;
    }
    return null;
  }
  const all = loadDemoVenue().theatres;
  let best: Theatre | null = null;
  let bestScore = 0;
  for (const t of all) {
    const score = wordScore(q, t.name);
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return bestScore > 0 ? best : null;
}

export async function fetchScreens(theatreId: string): Promise<Screen[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('screens')
      .select('*')
      .eq('theatre_id', theatreId)
      .order('screen_name');
    if (!error && data) return data as Screen[];
  }
  return loadDemoVenue().screens.filter((s) => s.theatre_id === theatreId);
}

export async function matchScreen(theatreId: string, label: string): Promise<Screen | null> {
  const screens = await fetchScreens(theatreId);
  if (!screens.length) return null;
  const digits = label.replace(/[^0-9]/g, '');
  if (digits) {
    const hit = screens.find((s) => s.screen_name.replace(/[^0-9]/g, '') === digits);
    if (hit) return hit;
  }
  const q = label.trim().toLowerCase();
  if (q) {
    const hit =
      screens.find((s) => s.screen_name.toLowerCase() === q) ||
      screens.find((s) => s.screen_name.toLowerCase().includes(q));
    if (hit) return hit;
  }
  return null;
}

export async function fetchSeats(screenId: string): Promise<Seat[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('seats')
      .select('*')
      .eq('screen_id', screenId)
      .order('row_name')
      .order('seat_number');
    if (!error && data) return data as Seat[];
  }
  return loadDemoVenue().seats.filter((s) => s.screen_id === screenId);
}

export async function fetchNavPoints(theatreId: string): Promise<NavPoint[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('navigation_points')
      .select('*')
      .eq('theatre_id', theatreId);
    if (!error && data) return data as NavPoint[];
  }
  return loadDemoVenue().points.filter((p) => p.theatre_id === theatreId);
}

export async function fetchNavEdges(pointIds: string[]): Promise<NavEdge[]> {
  if (!pointIds.length) return [];
  if (supabase) {
    const { data, error } = await supabase
      .from('navigation_edges')
      .select('*')
      .in('from_point_id', pointIds);
    if (!error && data) return data as NavEdge[];
  }
  const set = new Set(pointIds);
  return loadDemoVenue().edges.filter(
    (e) => set.has(e.from_point_id) && set.has(e.to_point_id),
  );
}

// ---------------------------------------------------------------------------
// Tickets + storage
// ---------------------------------------------------------------------------

export async function uploadTicketFile(
  file: File,
  userId: string,
  ticketId: string,
): Promise<string | undefined> {
  if (!supabase) return undefined;
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'ticket';
  const path = `${userId}/${ticketId}/${safe}`;
  const { error } = await supabase.storage
    .from('tickets')
    .upload(path, file, { upsert: true, contentType: file.type || 'application/octet-stream' });
  if (error) throw error;
  return path;
}

export interface SaveTicketInput {
  id: string;
  userId: string;
  platform: string;
  movie: string;
  theatre: string;
  screen: string;
  showTime: string;
  row: string;
  seat: string;
  confidence: number;
  theatreId?: string;
  screenId?: string;
  fileUrl?: string;
}

export async function saveTicketRecord(input: SaveTicketInput): Promise<string> {
  if (supabase) {
    const { data, error } = await supabase
      .from('tickets')
      .insert({
        user_id: input.userId,
        booking_platform: input.platform || null,
        theatre_id: input.theatreId ?? null,
        movie_name: input.movie || null,
        screen_id: input.screenId ?? null,
        show_time: input.showTime || null,
        row_name: input.row || null,
        seat_number: input.seat || null,
        uploaded_file_url: input.fileUrl ?? null,
        extraction_confidence: Math.round(input.confidence),
      })
      .select('id')
      .single();
    if (error) throw error;
    return data.id as string;
  }
  const rows = loadDemoTickets();
  rows.unshift({
    id: input.id,
    userId: input.userId,
    movie: input.movie,
    theatre: input.theatre,
    screen: input.screen,
    showTime: input.showTime,
    row: input.row,
    seat: input.seat,
    platform: input.platform,
    confidence: Math.round(input.confidence),
    createdAt: new Date().toISOString(),
    theatreId: input.theatreId,
    screenId: input.screenId,
  });
  saveDemoTickets(rows.slice(0, 50));
  return input.id;
}

export async function listUserTickets(userId: string): Promise<TicketListItem[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('tickets')
      .select('*, theatres(name), screens(screen_name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => ({
      id: String(r.id),
      movie: (r.movie_name as string) ?? '',
      theatre: ((r.theatres as { name?: string } | null)?.name as string) ?? '',
      screen: ((r.screens as { screen_name?: string } | null)?.screen_name as string) ?? '',
      showTime: (r.show_time as string) ?? '',
      row: (r.row_name as string) ?? '',
      seat: (r.seat_number as string) ?? '',
      platform: (r.booking_platform as string) ?? 'Other',
      confidence: (r.extraction_confidence as number) ?? null,
      createdAt: String(r.created_at ?? ''),
      theatreId: (r.theatre_id as string) ?? undefined,
      screenId: (r.screen_id as string) ?? undefined,
    }));
  }
  return loadDemoTickets().filter((t) => t.userId === userId);
}

export async function deleteTicketRecord(id: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from('tickets').delete().eq('id', id);
    if (error) throw error;
    return;
  }
  saveDemoTickets(loadDemoTickets().filter((t) => t.id !== id));
}

// ---------------------------------------------------------------------------
// Navigation sessions (best-effort; navigation works even if these fail)
// ---------------------------------------------------------------------------

export async function createNavSession(input: {
  userId: string;
  ticketId?: string;
  startingPoint?: string;
  destinationSeat?: string;
}): Promise<string | undefined> {
  if (!supabase) return `demo-session-${Date.now().toString(36)}`;
  try {
    const { data, error } = await supabase
      .from('navigation_sessions')
      .insert({
        user_id: input.userId,
        ticket_id: input.ticketId ?? null,
        starting_point: input.startingPoint ?? null,
        destination_seat: input.destinationSeat ?? null,
        current_navigation_point: input.startingPoint ?? null,
      })
      .select('id')
      .single();
    if (error) return undefined;
    return data.id as string;
  } catch {
    return undefined;
  }
}

export async function updateSessionPoint(sessionId: string | undefined, pointId: string): Promise<void> {
  if (!supabase || !sessionId || sessionId.startsWith('demo-session')) return;
  try {
    await supabase
      .from('navigation_sessions')
      .update({ current_navigation_point: pointId })
      .eq('id', sessionId);
  } catch {
    /* best effort */
  }
}

export async function completeNavSession(sessionId: string | undefined): Promise<void> {
  if (!supabase || !sessionId || sessionId.startsWith('demo-session')) return;
  try {
    await supabase
      .from('navigation_sessions')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', sessionId);
  } catch {
    /* best effort */
  }
}

// ---------------------------------------------------------------------------
// Admin CRUD (Supabase, or the demo venue sandbox in demo mode)
// ---------------------------------------------------------------------------

const TABLE_OF: Record<AdminKind, keyof DemoVenue> = {
  theatres: 'theatres',
  screens: 'screens',
  seats: 'seats',
  navigation_points: 'points',
  navigation_edges: 'edges',
};

function demoId(): string {
  return `demo-${Date.now().toString(36)}-${Math.floor(Math.random() * 10000)}`;
}

export async function adminList(
  kind: AdminKind,
  parent?: { theatreId?: string; screenId?: string; pointIds?: string[] },
): Promise<Record<string, unknown>[]> {
  if (supabase) {
    let query = supabase.from(kind).select('*');
    if (kind === 'screens' && parent?.theatreId) query = query.eq('theatre_id', parent.theatreId);
    if (kind === 'seats' && parent?.screenId) {
      query = query.eq('screen_id', parent.screenId).order('row_name').order('seat_number');
    }
    if (kind === 'navigation_points' && parent?.theatreId) {
      query = query.eq('theatre_id', parent.theatreId);
    }
    if (kind === 'navigation_edges' && parent?.pointIds?.length) {
      query = query.in('from_point_id', parent.pointIds);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as Record<string, unknown>[];
  }
  const venue = loadDemoVenue();
  const arr = [...(venue[TABLE_OF[kind]] as unknown as Record<string, unknown>[])];
  if (kind === 'screens' && parent?.theatreId) return arr.filter((r) => r.theatre_id === parent.theatreId);
  if (kind === 'seats' && parent?.screenId) return arr.filter((r) => r.screen_id === parent.screenId);
  if (kind === 'navigation_points' && parent?.theatreId) {
    return arr.filter((r) => r.theatre_id === parent.theatreId);
  }
  if (kind === 'navigation_edges' && parent?.pointIds) {
    const set = new Set(parent.pointIds);
    return arr.filter((r) => set.has(r.from_point_id as string));
  }
  return arr;
}

export async function adminUpsert(
  kind: AdminKind,
  row: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (supabase) {
    const payload = { ...row };
    if (!payload.id) delete payload.id;
    const { data, error } = await supabase.from(kind).upsert(payload).select().single();
    if (error) throw error;
    return data as Record<string, unknown>;
  }
  const venue = loadDemoVenue();
  const arr = venue[TABLE_OF[kind]] as unknown as Record<string, unknown>[];
  if (row.id) {
    const idx = arr.findIndex((r) => r.id === row.id);
    if (idx >= 0) arr[idx] = { ...arr[idx], ...row };
    else arr.push({ ...row });
  } else {
    row = { ...row, id: demoId() };
    arr.push(row);
  }
  saveDemoVenue(venue);
  return row;
}

export async function adminDelete(kind: AdminKind, id: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from(kind).delete().eq('id', id);
    if (error) throw error;
    return;
  }
  const venue = loadDemoVenue();
  (venue[TABLE_OF[kind]] as unknown as Record<string, unknown>[]) = (
    venue[TABLE_OF[kind]] as unknown as Record<string, unknown>[]
  ).filter((r) => r.id !== id);
  saveDemoVenue(venue);
}
