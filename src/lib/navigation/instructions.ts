// Converts a graph path into simple human navigation steps + ETA,
// and builds the full route from a starting checkpoint to an exact seat.

import type { NavEdge, NavPoint, RouteLeg, Seat } from '../../types';
import { dijkstra } from './graph';
import { findSeat } from '../data/sampleTheatre';

export const DEST_SEAT_ID = 'dest-seat';

export function buildLegs(
  points: NavPoint[],
  edges: NavEdge[],
  pathIds: string[],
): { legs: RouteLeg[]; totalDistance: number; etaMinutes: number } {
  const byId = new Map(points.map((p) => [p.id, p]));
  const legs: RouteLeg[] = [];
  let total = 0;

  for (let i = 0; i < pathIds.length - 1; i++) {
    const a = pathIds[i];
    const b = pathIds[i + 1];
    const from = byId.get(a);
    const to = byId.get(b);
    if (!from || !to) continue;
    const edge = edges.find(
      (e) =>
        (e.from_point_id === a && e.to_point_id === b) ||
        (e.from_point_id === b && e.to_point_id === a),
    );
    const distance = Math.round(edge?.distance ?? 10);
    total += distance;

    let title = `Walk to ${to.name}`;
    let detail = `About ${distance} m`;
    let icon: RouteLeg['icon'] = 'walk';

    const hint = edge?.direction?.trim();
    if (hint && !/^(walk straight|continue straight)/i.test(hint)) {
      detail = hint;
    } else if (hint) {
      detail = hint;
    }

    if (to.type === 'stairs' || to.type === 'escalator') {
      title = 'Take the stairs / escalator';
      detail = hint || `Walk ${distance} m to ${to.name}`;
      icon = 'stairs';
    } else if (to.type === 'screen_entry') {
      title = `Enter ${to.name}`;
      detail = 'Have your ticket ready for checking';
      icon = 'door';
    } else if (to.type === 'seat') {
      title = 'Find your seat';
      detail = `Your seat is ${to.name} — look for the row markers`;
      icon = 'seat';
    } else if (/ticket/i.test(to.name)) {
      title = 'Get your ticket checked';
      detail = `Walk ${distance} m to ${to.name}`;
      icon = 'ticket';
    } else if (to.type === 'entrance') {
      title = `Head to ${to.name}`;
      icon = 'flag';
    }

    legs.push({ fromId: a, toId: b, fromName: from.name, toName: to.name, distance, title, detail, icon });
  }

  const totalDistance = Math.round(total);
  // Indoor crowded pace ≈ 50–60 m/min
  const etaMinutes = Math.max(1, Math.ceil(totalDistance / 55));
  return { legs, totalDistance, etaMinutes };
}

export interface SeatRoute {
  allPoints: NavPoint[];
  allEdges: NavEdge[];
  pathIds: string[];
  legs: RouteLeg[];
  totalDistance: number;
  etaMinutes: number;
  destSeat: Seat | null;
}

export function computeRouteToSeat(
  points: NavPoint[],
  edges: NavEdge[],
  seats: Seat[],
  startId: string,
  row: string,
  seatNum: number | string,
): SeatRoute | null {
  if (!points.length || !startId) return null;
  const destSeat = findSeat(seats, row, seatNum);

  // Connect the seat to the nearest aisle / screen-entry checkpoint.
  const aisle =
    points.find((p) => /aisle/i.test(p.name)) ||
    points.find((p) => p.type === 'screen_entry') ||
    [...points].sort((a, b) => a.y_position - b.y_position)[0];
  if (!aisle) return null;

  // If the user starts at/inside the seating area, still route via the aisle.
  const destPoint: NavPoint = {
    id: DEST_SEAT_ID,
    theatre_id: aisle.theatre_id,
    screen_id: aisle.screen_id ?? null,
    name: `Seat ${String(row).toUpperCase()}${seatNum}`,
    type: 'seat',
    x_position: destSeat?.x_position ?? aisle.x_position + 40,
    y_position: destSeat?.y_position ?? Math.max(20, aisle.y_position - 24),
  };

  const dx = destPoint.x_position - aisle.x_position;
  const dy = destPoint.y_position - aisle.y_position;
  const seatDist = Math.max(3, Math.round(Math.sqrt(dx * dx + dy * dy) / 8));

  const allPoints = [...points.filter((p) => p.id !== DEST_SEAT_ID), destPoint];
  const allEdges: NavEdge[] = [
    ...edges,
    {
      id: 'edge-aisle-seat',
      from_point_id: aisle.id,
      to_point_id: DEST_SEAT_ID,
      distance: seatDist,
      direction: `Walk along the row to Seat ${String(row).toUpperCase()}${seatNum}`,
      accessible: true,
    },
  ];

  const result = dijkstra(allPoints, allEdges, startId, DEST_SEAT_ID);
  if (!result) return null;
  const { legs, totalDistance, etaMinutes } = buildLegs(allPoints, allEdges, result.path);
  return { allPoints, allEdges, pathIds: result.path, legs, totalDistance, etaMinutes, destSeat };
}

/** Remaining walking distance from the current step onward. */
export function remainingDistance(legs: RouteLeg[], stepIndex: number): number {
  return legs.slice(stepIndex).reduce((sum, leg) => sum + leg.distance, 0);
}
