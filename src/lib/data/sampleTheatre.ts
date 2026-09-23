// Sample / demo venue data used when Supabase is not configured
// (and as the seed for the demo-mode admin sandbox).
// Coordinate space matches TheatreMap: SVG viewBox 0 0 480 600.

import type { NavEdge, NavPoint, Screen, Seat, Theatre } from '../../types';

export const SAMPLE_THEATRE: Theatre = {
  id: 'theatre-pvr-demo',
  name: 'PVR INOX Example Mall',
  location: 'Example Mall, 2nd Floor',
  city: 'Hyderabad',
  address: 'Example Mall, Road No. 12, Banjara Hills, Hyderabad 500034',
  latitude: 17.4235,
  longitude: 78.4442,
};

export const SAMPLE_SCREENS: Screen[] = [
  {
    id: 'screen-4',
    theatre_id: SAMPLE_THEATRE.id,
    screen_name: 'Screen 4',
    floor: 'Level 2',
  },
];

const ROW_SPECS: Array<{ row: string; count: number }> = [
  { row: 'A', count: 12 },
  { row: 'B', count: 12 },
  { row: 'C', count: 12 },
  { row: 'D', count: 12 },
  { row: 'E', count: 12 },
  { row: 'F', count: 12 },
  { row: 'G', count: 20 },
];

/** Seat coordinates: x spread around centre 240, y = 40 + rowIndex * 9. */
export function seatCoords(row: string, num: number, count: number) {
  const rowIdx = Math.max(0, row.toUpperCase().charCodeAt(0) - 65);
  return {
    x: Math.round(240 + (num - (count + 1) / 2) * 16),
    y: 40 + rowIdx * 9,
  };
}

export function buildSampleSeats(screenId: string): Seat[] {
  const seats: Seat[] = [];
  for (const spec of ROW_SPECS) {
    for (let n = 1; n <= spec.count; n++) {
      const { x, y } = seatCoords(spec.row, n, spec.count);
      seats.push({
        id: `seat-${spec.row}${n}`,
        screen_id: screenId,
        row_name: spec.row,
        seat_number: n,
        x_position: x,
        y_position: y,
        seat_type: spec.row === 'G' ? 'recliner' : 'standard',
      });
    }
  }
  return seats;
}

export const SAMPLE_NAV_POINTS: NavPoint[] = [
  { id: 'pt-entrance', theatre_id: SAMPLE_THEATRE.id, name: 'Main Entrance', type: 'entrance', x_position: 240, y_position: 566, floor: 'Ground', qr_code: 'FMS-ENT-01' },
  { id: 'pt-lobby', theatre_id: SAMPLE_THEATRE.id, name: 'Lobby', type: 'checkpoint', x_position: 240, y_position: 512, floor: 'Ground', qr_code: 'FMS-LOB-02' },
  { id: 'pt-ticket-check', theatre_id: SAMPLE_THEATRE.id, name: 'Ticket Check', type: 'checkpoint', x_position: 240, y_position: 462, floor: 'Ground', qr_code: 'FMS-TCK-03' },
  { id: 'pt-corridor-a', theatre_id: SAMPLE_THEATRE.id, name: 'Corridor A', type: 'corridor', x_position: 240, y_position: 408, floor: 'Ground', qr_code: 'FMS-COR-04' },
  { id: 'pt-food', theatre_id: SAMPLE_THEATRE.id, name: 'Food Counter', type: 'food_counter', x_position: 140, y_position: 408, floor: 'Ground', qr_code: 'FMS-FOD-05' },
  { id: 'pt-restrooms', theatre_id: SAMPLE_THEATRE.id, name: 'Restrooms', type: 'restroom', x_position: 340, y_position: 408, floor: 'Ground', qr_code: 'FMS-RES-06' },
  { id: 'pt-stairs', theatre_id: SAMPLE_THEATRE.id, name: 'Stairs / Escalator', type: 'stairs', x_position: 240, y_position: 348, floor: 'Ground', qr_code: 'FMS-STR-07' },
  { id: 'pt-landing-2', theatre_id: SAMPLE_THEATRE.id, name: 'Level 2 Landing', type: 'checkpoint', x_position: 240, y_position: 282, floor: 'Level 2', qr_code: 'FMS-LVL-08' },
  { id: 'pt-s4-corridor', theatre_id: SAMPLE_THEATRE.id, screen_id: 'screen-4', name: 'Screen 4 Corridor', type: 'corridor', x_position: 240, y_position: 222, floor: 'Level 2', qr_code: 'FMS-S4C-09' },
  { id: 'pt-s4-entry', theatre_id: SAMPLE_THEATRE.id, screen_id: 'screen-4', name: 'Screen 4 Entrance', type: 'screen_entry', x_position: 240, y_position: 168, floor: 'Level 2', qr_code: 'FMS-S4E-10' },
  { id: 'pt-row-g-aisle', theatre_id: SAMPLE_THEATRE.id, screen_id: 'screen-4', name: 'Row G Aisle', type: 'checkpoint', x_position: 240, y_position: 108, floor: 'Level 2', qr_code: 'FMS-AIS-11' },
];

export const SAMPLE_NAV_EDGES: NavEdge[] = [
  { id: 'e1', from_point_id: 'pt-entrance', to_point_id: 'pt-lobby', distance: 12, direction: 'Walk straight through the main doors into the lobby', accessible: true },
  { id: 'e2', from_point_id: 'pt-lobby', to_point_id: 'pt-ticket-check', distance: 10, direction: 'Walk straight to the ticket checking counter', accessible: true },
  { id: 'e3', from_point_id: 'pt-ticket-check', to_point_id: 'pt-corridor-a', distance: 11, direction: 'Continue straight into Corridor A', accessible: true },
  { id: 'e4', from_point_id: 'pt-corridor-a', to_point_id: 'pt-stairs', distance: 13, direction: 'Walk to the end of the corridor to the stairs', accessible: true },
  { id: 'e5', from_point_id: 'pt-stairs', to_point_id: 'pt-landing-2', distance: 9, direction: 'Take the stairs or escalator up to Level 2', accessible: true },
  { id: 'e6', from_point_id: 'pt-landing-2', to_point_id: 'pt-s4-corridor', distance: 12, direction: 'Turn into the Screen 4 corridor', accessible: true },
  { id: 'e7', from_point_id: 'pt-s4-corridor', to_point_id: 'pt-s4-entry', distance: 11, direction: 'Walk to the Screen 4 entrance', accessible: true },
  { id: 'e8', from_point_id: 'pt-s4-entry', to_point_id: 'pt-row-g-aisle', distance: 10, direction: 'Enter Screen 4 and walk down to the Row G aisle', accessible: true },
  { id: 'e9', from_point_id: 'pt-corridor-a', to_point_id: 'pt-food', distance: 14, direction: 'Food counter is on your left', accessible: true },
  { id: 'e10', from_point_id: 'pt-corridor-a', to_point_id: 'pt-restrooms', distance: 14, direction: 'Restrooms are on your right', accessible: true },
];

/** Realistic BookMyShow-style ticket text for the one-tap demo. */
export const SAMPLE_TICKET_TEXT = `BookMyShow M-Ticket
Avengers: Secret Wars (U/A) | English
PVR INOX Example Mall
Example Mall, Banjara Hills, Hyderabad
Screen 4
Wed, 24 Sep 2025 | 07:30 PM
SILVER-G: Row G Seat 18
1 Ticket | Booking ID MS9X2KLA`;

export function findSeat(seats: Seat[], row: string, num: number | string): Seat | null {
  const n = Number(num);
  return (
    seats.find(
      (s) => s.row_name.toUpperCase() === String(row).toUpperCase() && Number(s.seat_number) === n,
    ) ?? null
  );
}

export function seatLabel(row: string, seat: string | number): string {
  return `${String(row).toUpperCase()}${seat}`;
}
