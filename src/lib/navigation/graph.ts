// Pathfinding over the indoor navigation graph (Dijkstra).
// Edges are treated as walkable in both directions.

import type { NavEdge, NavPoint } from '../../types';

interface AdjEntry {
  to: string;
  weight: number;
}

export function dijkstra(
  points: NavPoint[],
  edges: NavEdge[],
  startId: string,
  endId: string,
): { path: string[]; distance: number } | null {
  const ids = new Set(points.map((p) => p.id));
  if (!ids.has(startId) || !ids.has(endId)) return null;
  if (startId === endId) return { path: [startId], distance: 0 };

  const adj = new Map<string, AdjEntry[]>();
  for (const p of points) adj.set(p.id, []);
  for (const e of edges) {
    if (!ids.has(e.from_point_id) || !ids.has(e.to_point_id)) continue;
    const w = e.distance && e.distance > 0 ? e.distance : 10;
    adj.get(e.from_point_id)!.push({ to: e.to_point_id, weight: w });
    adj.get(e.to_point_id)!.push({ to: e.from_point_id, weight: w });
  }

  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const visited = new Set<string>();
  for (const p of points) {
    dist.set(p.id, Infinity);
    prev.set(p.id, null);
  }
  dist.set(startId, 0);

  for (;;) {
    let current: string | null = null;
    let best = Infinity;
    for (const [id, d] of dist) {
      if (!visited.has(id) && d < best) {
        best = d;
        current = id;
      }
    }
    if (current === null || best === Infinity) return null; // unreachable
    if (current === endId) break;
    visited.add(current);
    for (const { to, weight } of adj.get(current) ?? []) {
      if (visited.has(to)) continue;
      const alt = (dist.get(current) ?? Infinity) + weight;
      if (alt < (dist.get(to) ?? Infinity)) {
        dist.set(to, alt);
        prev.set(to, current);
      }
    }
  }

  const path: string[] = [];
  let cursor: string | null = endId;
  while (cursor) {
    path.unshift(cursor);
    cursor = prev.get(cursor) ?? null;
  }
  if (path[0] !== startId) return null;
  return { path, distance: Math.round(dist.get(endId) ?? 0) };
}
