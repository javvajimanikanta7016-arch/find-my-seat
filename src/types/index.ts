// Shared TypeScript types for Find My Seat.

export type ViewName =
  | 'home'
  | 'auth'
  | 'upload'
  | 'confirm'
  | 'map'
  | 'navigate'
  | 'arrival'
  | 'tickets'
  | 'admin';

export interface AppUser {
  id: string;
  email: string;
  name?: string;
  role?: 'user' | 'admin';
  isDemo?: boolean;
}

export interface Theatre {
  id: string;
  name: string;
  location?: string | null;
  city?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  map_data?: Record<string, unknown> | null;
  created_at?: string;
}

export interface Screen {
  id: string;
  theatre_id: string;
  screen_name: string;
  floor?: string | null;
  seating_layout?: Record<string, unknown> | null;
  map_data?: Record<string, unknown> | null;
}

export interface Seat {
  id: string;
  screen_id: string;
  row_name: string;
  seat_number: number;
  x_position?: number | null;
  y_position?: number | null;
  seat_type?: string | null;
  accessibility_info?: string | null;
}

export interface NavPoint {
  id: string;
  theatre_id: string;
  screen_id?: string | null;
  name: string;
  type: string;
  x_position: number;
  y_position: number;
  floor?: string | null;
  qr_code?: string | null;
  connected_points?: string[] | null;
}

export interface NavEdge {
  id: string;
  from_point_id: string;
  to_point_id: string;
  distance?: number | null;
  direction?: string | null;
  accessible?: boolean | null;
}

/** Raw extraction result (before user confirmation). */
export interface TicketDraft {
  movie: string;
  theatre: string;
  screen: string;
  showTime: string;
  row: string;
  seat: string;
  platform: string;
  confidence: number; // 0-100
  level: 'high' | 'medium' | 'low';
  rawText: string;
  fileName?: string;
  fileDataUrl?: string;
}

export interface ConfirmedTicket extends TicketDraft {
  id: string;
  userId: string;
  theatreId?: string;
  screenId?: string;
  fileUrl?: string;
}

export interface TicketListItem {
  id: string;
  movie: string;
  theatre: string;
  screen: string;
  showTime: string;
  row: string;
  seat: string;
  platform: string;
  confidence: number | null;
  createdAt: string;
  theatreId?: string;
  screenId?: string;
}

export interface RouteLeg {
  fromId: string;
  toId: string;
  fromName: string;
  toName: string;
  distance: number;
  title: string;
  detail: string;
  icon: 'walk' | 'stairs' | 'door' | 'ticket' | 'seat' | 'flag' | 'turn';
}

export interface NavSession {
  id: string;
  user_id: string;
  ticket_id?: string | null;
  starting_point?: string | null;
  destination_seat?: string | null;
  current_navigation_point?: string | null;
  started_at?: string;
  completed_at?: string | null;
}

export type MatchResult = 'idle' | 'searching' | 'found' | 'unsupported' | 'error';

export type AdminKind =
  | 'theatres'
  | 'screens'
  | 'seats'
  | 'navigation_points'
  | 'navigation_edges';
