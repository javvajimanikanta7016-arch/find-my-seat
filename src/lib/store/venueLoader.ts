// Loads the demo venue in the shape the store expects
// (used for demo mode + "try the demo theatre" fallback).

import type { NavEdge, NavPoint, Screen, Seat, Theatre } from '../../types';
import { loadDemoVenue } from '../supabase/client';

export interface StoreVenue {
  theatre: Theatre;
  screens: Screen[];
  screen: Screen | null;
  seats: Seat[];
  points: NavPoint[];
  edges: NavEdge[];
}

export async function loadDemoDataForStore(preferTheatreId?: string): Promise<StoreVenue> {
  const venue = loadDemoVenue();
  const theatre = venue.theatres.find((t) => t.id === preferTheatreId) ?? venue.theatres[0];
  const screens = venue.screens.filter((s) => s.theatre_id === theatre.id);
  const screen = screens[0] ?? null;
  const seats = screen ? venue.seats.filter((s) => s.screen_id === screen.id) : [];
  const points = venue.points.filter((p) => p.theatre_id === theatre.id);
  const ids = new Set(points.map((p) => p.id));
  const edges = venue.edges.filter((e) => ids.has(e.from_point_id) && ids.has(e.to_point_id));
  return { theatre, screens, screen, seats, points, edges };
}
