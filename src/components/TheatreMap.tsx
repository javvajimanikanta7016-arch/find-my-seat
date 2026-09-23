// Indoor SVG theatre map + zoomed seating map.
// Coordinate space: viewBox 0 0 480 600 (Ground floor at the bottom,
// Level 2 in the middle, Screen 4 seating at the top).

import type { NavEdge, NavPoint, Seat } from '../types';

const TYPE_FILL: Record<string, string> = {
  entrance: '#34d399',
  checkpoint: '#a1a1aa',
  corridor: '#71717a',
  stairs: '#38bdf8',
  escalator: '#38bdf8',
  screen_entry: '#f87171',
  food_counter: '#fbbf24',
  restroom: '#22d3ee',
  seat: '#ef4444',
};

interface TheatreMapProps {
  points: NavPoint[];
  edges: NavEdge[];
  seats?: Seat[];
  pathIds?: string[];
  currentId?: string | null;
  destSeat?: Seat | null;
  showSeats?: boolean;
}

export function TheatreMap({
  points,
  edges,
  seats = [],
  pathIds = [],
  currentId = null,
  destSeat = null,
  showSeats = true,
}: TheatreMapProps) {
  const byId = new Map(points.map((p) => [p.id, p]));
  const pathSet = new Set(pathIds);
  const consecutive = new Set<string>();
  for (let i = 0; i < pathIds.length - 1; i++) {
    consecutive.add([pathIds[i], pathIds[i + 1]].sort().join('|'));
  }
  const rows = [...new Set(seats.map((s) => s.row_name))].sort();
  const rowAnchor = new Map<string, { x: number; y: number }>();
  for (const r of rows) {
    const inRow = seats.filter((s) => s.row_name === r);
    rowAnchor.set(r, {
      x: Math.min(...inRow.map((s) => s.x_position ?? 240)),
      y: inRow[0]?.y_position ?? 60,
    });
  }

  return (
    <svg viewBox="0 0 480 600" className="h-auto w-full" role="img" aria-label="Indoor theatre map">
      {/* floor zones */}
      <rect x="8" y="8" width="464" height="118" rx="14" fill="#18181d" stroke="#27272a" />
      <text x="24" y="26" fontSize="10" fill="#71717a" fontWeight="800" letterSpacing="1.5">
        SCREEN · SEATING
      </text>
      <rect x="8" y="134" width="464" height="180" rx="14" fill="#101014" stroke="#27272a" />
      <text x="24" y="152" fontSize="10" fill="#71717a" fontWeight="800" letterSpacing="1.5">
        LEVEL 2
      </text>
      <rect x="8" y="322" width="464" height="270" rx="14" fill="#101014" stroke="#27272a" />
      <text x="24" y="340" fontSize="10" fill="#71717a" fontWeight="800" letterSpacing="1.5">
        GROUND FLOOR
      </text>

      {/* screen bar */}
      <rect x="140" y="18" width="200" height="13" rx="6.5" fill="#3f3f46" />
      <text x="240" y="28" textAnchor="middle" fontSize="8.5" fill="#e4e4e7" fontWeight="800" letterSpacing="2">
        SCREEN
      </text>

      {/* seats */}
      {showSeats &&
        seats.map((s) => {
          const isDest = destSeat != null && s.id === destSeat.id;
          return (
            <rect
              key={s.id}
              x={(s.x_position ?? 240) - 6}
              y={(s.y_position ?? 60) - 4}
              width="12"
              height="8"
              rx="2.5"
              fill={isDest ? '#fbbf24' : 'rgba(255,255,255,0.22)'}
              stroke={isDest ? '#f59e0b' : 'none'}
              strokeWidth={isDest ? 2 : 0}
              className={isDest ? 'animate-blip' : undefined}
            />
          );
        })}
      {showSeats &&
        rows.map((r) => {
          const a = rowAnchor.get(r);
          if (!a) return null;
          return (
            <text key={r} x={a.x - 17} y={a.y + 3.5} fontSize="9" fill="#a1a1aa" textAnchor="middle" fontWeight="700">
              {r}
            </text>
          );
        })}

      {/* route edges */}
      {edges.map((e) => {
        const a = byId.get(e.from_point_id);
        const b = byId.get(e.to_point_id);
        if (!a || !b) return null;
        const onRoute = consecutive.has([e.from_point_id, e.to_point_id].sort().join('|'));
        return (
          <line
            key={e.id}
            x1={a.x_position}
            y1={a.y_position}
            x2={b.x_position}
            y2={b.y_position}
            stroke={onRoute ? '#fbbf24' : 'rgba(255,255,255,0.14)'}
            strokeWidth={onRoute ? 4 : 2}
            strokeLinecap="round"
            className={onRoute ? 'route-anim' : undefined}
            opacity={onRoute ? 1 : pathIds.length ? 0.45 : 1}
          />
        );
      })}

      {/* checkpoints */}
      {points.map((p, i) => {
        const isCurrent = currentId === p.id;
        const isDest = p.type === 'seat';
        const onPath = pathSet.has(p.id);
        const fill = isCurrent ? '#fbbf24' : (TYPE_FILL[p.type] ?? '#a1a1aa');
        const side = i % 2 === 0 ? 1 : -1;
        return (
          <g key={p.id} opacity={pathIds.length && !onPath && !isCurrent ? 0.4 : 1}>
            {(isCurrent || isDest) && (
              <circle cx={p.x_position} cy={p.y_position} r="14" fill="none" stroke={isCurrent ? '#fbbf24' : '#ef4444'} strokeWidth="2" className="animate-blip" />
            )}
            <circle cx={p.x_position} cy={p.y_position} r={isCurrent || isDest ? 8 : 6} fill={fill} stroke="#09090b" strokeWidth="2" />
            <text
              x={p.x_position + side * 13}
              y={p.y_position + 4}
              fontSize="10.5"
              fontWeight={isCurrent || isDest ? 800 : 600}
              fill={isCurrent ? '#fde68a' : isDest ? '#fecaca' : '#d4d4d8'}
              textAnchor={side === 1 ? 'start' : 'end'}
              stroke="#09090b"
              strokeWidth="3"
              style={{ paintOrder: 'stroke' }}
            >
              {p.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

interface SeatingMapProps {
  seats: Seat[];
  destSeat: Seat | null;
  screenName?: string;
}

export function SeatingMap({ seats, destSeat, screenName }: SeatingMapProps) {
  if (!seats.length) {
    return (
      <div className="card text-center text-sm text-zinc-400">
        Seating map isn&apos;t available for this screen yet.
      </div>
    );
  }
  const rows = [...new Set(seats.map((s) => s.row_name))].sort();
  const rowAnchor = new Map<string, { x: number; y: number }>();
  for (const r of rows) {
    const inRow = seats.filter((s) => s.row_name === r);
    rowAnchor.set(r, {
      x: Math.min(...inRow.map((s) => s.x_position ?? 240)),
      y: inRow[0]?.y_position ?? 60,
    });
  }
  return (
    <svg viewBox="30 6 420 118" className="h-auto w-full" role="img" aria-label="Seating map">
      <rect x="140" y="10" width="200" height="13" rx="6.5" fill="#3f3f46" />
      <text x="240" y="20" textAnchor="middle" fontSize="8.5" fill="#e4e4e7" fontWeight="800" letterSpacing="1.5">
        SCREEN{screenName ? ` · ${screenName.toUpperCase()}` : ''}
      </text>
      {seats.map((s) => {
        const isDest = destSeat != null && s.id === destSeat.id;
        return (
          <rect
            key={s.id}
            x={(s.x_position ?? 240) - 6}
            y={(s.y_position ?? 60) - 4}
            width="12"
            height="8"
            rx="2.5"
            fill={isDest ? '#fbbf24' : 'rgba(255,255,255,0.25)'}
            stroke={isDest ? '#fff7ed' : 'none'}
            strokeWidth={isDest ? 1.5 : 0}
            className={isDest ? 'animate-blip' : undefined}
          />
        );
      })}
      {rows.map((r) => {
        const a = rowAnchor.get(r);
        if (!a) return null;
        return (
          <text key={r} x={a.x - 18} y={a.y + 3.5} fontSize="9.5" fill="#a1a1aa" textAnchor="middle" fontWeight="700">
            {r}
          </text>
        );
      })}
      {destSeat && (
        <text
          x={destSeat.x_position ?? 240}
          y={(destSeat.y_position ?? 60) - 10}
          textAnchor="middle"
          fontSize="12"
          fontWeight="800"
          fill="#fbbf24"
          stroke="#09090b"
          strokeWidth="3"
          style={{ paintOrder: 'stroke' }}
        >
          {destSeat.row_name}
          {destSeat.seat_number} ▼
        </text>
      )}
    </svg>
  );
}
