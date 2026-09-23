// Global flow state: Upload → Confirm → Map → Navigate → Arrive.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  AppUser,
  ConfirmedTicket,
  MatchResult,
  NavEdge,
  NavPoint,
  RouteLeg,
  Screen,
  Seat,
  Theatre,
  TicketDraft,
  TicketListItem,
  ViewName,
} from '../../types';
import { computeRouteToSeat } from '../navigation/instructions';
import { findSeat } from '../data/sampleTheatre';
import { loadDemoDataForStore } from './venueLoader';
import {
  completeNavSession,
  createNavSession,
  fetchNavEdges,
  fetchNavPoints,
  fetchScreens,
  fetchSeats,
  getSessionUser,
  isSupabaseConfigured,
  matchScreen,
  matchTheatreByName,
  saveTicketRecord,
  signOutEverywhere,
  updateSessionPoint,
  uploadTicketFile,
} from '../supabase/client';

function newId(prefix: string): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    /* fallback below */
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`;
}

interface AppState {
  view: ViewName;
  go: (view: ViewName) => void;
  uploadMode: 'file' | 'camera';
  setUploadMode: (mode: 'file' | 'camera') => void;

  user: AppUser | null;
  setUser: (user: AppUser | null) => void;
  isAdmin: boolean;
  authReady: boolean;
  signOut: () => Promise<void>;

  draft: TicketDraft | null;
  setDraft: (draft: TicketDraft | null) => void;
  pendingFile: File | null;
  setPendingFile: (file: File | null) => void;
  confirmed: ConfirmedTicket | null;

  theatre: Theatre | null;
  screens: Screen[];
  screen: Screen | null;
  selectScreen: (screenId: string) => Promise<void>;
  seats: Seat[];
  points: NavPoint[];
  edges: NavEdge[];
  destSeat: Seat | null;

  matchResult: MatchResult;
  matchError: string;
  confirmTicket: (final: TicketDraft) => Promise<MatchResult>;
  useDemoTheatre: () => Promise<void>;
  resumeTicket: (item: TicketListItem) => Promise<void>;

  startId: string;
  routePoints: NavPoint[];
  routeEdges: NavEdge[];
  pathIds: string[];
  legs: RouteLeg[];
  totalDistance: number;
  etaMinutes: number;
  stepIndex: number;
  currentId: string | null;
  offRoute: boolean;

  beginNavigation: (start: string) => void;
  advanceStep: () => void;
  scanCheckpoint: (input: string) => { ok: boolean; message: string };
  endNavigation: (completed: boolean) => void;

  toast: string | null;
  notify: (message: string) => void;
  resetFlow: () => void;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const value = useContext(Ctx);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [view, setView] = useState<ViewName>('home');
  const [uploadMode, setUploadMode] = useState<'file' | 'camera'>('file');
  const [user, setUser] = useState<AppUser | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [draft, setDraft] = useState<TicketDraft | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [confirmed, setConfirmed] = useState<ConfirmedTicket | null>(null);

  const [theatre, setTheatre] = useState<Theatre | null>(null);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [screen, setScreen] = useState<Screen | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [points, setPoints] = useState<NavPoint[]>([]);
  const [edges, setEdges] = useState<NavEdge[]>([]);
  const [destSeat, setDestSeat] = useState<Seat | null>(null);

  const [matchResult, setMatchResult] = useState<MatchResult>('idle');
  const [matchError, setMatchError] = useState('');

  const [startId, setStartId] = useState('');
  const [routePoints, setRoutePoints] = useState<NavPoint[]>([]);
  const [routeEdges, setRouteEdges] = useState<NavEdge[]>([]);
  const [pathIds, setPathIds] = useState<string[]>([]);
  const [legs, setLegs] = useState<RouteLeg[]>([]);
  const [totalDistance, setTotalDistance] = useState(0);
  const [etaMinutes, setEtaMinutes] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [offRoute, setOffRoute] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const sessionRef = useRef<string | undefined>(undefined);
  const toastTimer = useRef<number | undefined>(undefined);

  const go = useCallback((next: ViewName) => {
    setView(next);
    try {
      window.scrollTo({ top: 0 });
    } catch {
      /* ignore */
    }
  }, []);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  }, []);

  useEffect(() => {
    let alive = true;
    getSessionUser()
      .then((u) => {
        if (!alive) return;
        setUser(u);
        try {
          // If we returned from Google OAuth (?code=...) but have no session,
          // the exchange failed (e.g. in-app browser) — say so plainly.
          const params = new URLSearchParams(window.location.search);
          if (params.has('code')) {
            if (!u) {
              notify(
                'Google sign-in could not be completed. Try again in Chrome or Safari (not an in-app browser).',
              );
            }
            params.delete('code');
            const qs = params.toString();
            window.history.replaceState(
              {},
              '',
              `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`,
            );
          }
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        /* stay signed out */
      })
      .finally(() => {
        if (alive) setAuthReady(true);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = useCallback(async () => {
    await signOutEverywhere();
    setUser(null);
  }, []);

  const applyVenue = useCallback(
    (
      venue: {
        theatre: Theatre;
        screens: Screen[];
        screen: Screen | null;
        seats: Seat[];
        points: NavPoint[];
        edges: NavEdge[];
      },
      final: TicketDraft,
    ) => {
      setTheatre(venue.theatre);
      setScreens(venue.screens);
      setScreen(venue.screen);
      setSeats(venue.seats);
      setPoints(venue.points);
      setEdges(venue.edges);
      setDestSeat(findSeat(venue.seats, final.row, final.seat));
      setRoutePoints([]);
      setRouteEdges([]);
      setPathIds([]);
      setLegs([]);
      setStepIndex(0);
      setStartId('');
      setOffRoute(false);
    },
    [],
  );

  const confirmTicket = useCallback(
    async (final: TicketDraft): Promise<MatchResult> => {
      setMatchResult('searching');
      setMatchError('');
      try {
        const matched = await matchTheatreByName(final.theatre);
        if (!matched) {
          setMatchResult('unsupported');
          return 'unsupported';
        }
        const venueScreens = await fetchScreens(matched.id);
        const venueScreen =
          (await matchScreen(matched.id, final.screen)) ?? venueScreens[0] ?? null;
        const [seatRows, navPoints] = await Promise.all([
          venueScreen ? fetchSeats(venueScreen.id) : Promise.resolve([] as Seat[]),
          fetchNavPoints(matched.id),
        ]);
        const navEdges = navPoints.length
          ? await fetchNavEdges(navPoints.map((p) => p.id))
          : [];
        applyVenue(
          {
            theatre: matched,
            screens: venueScreens,
            screen: venueScreen,
            seats: seatRows,
            points: navPoints,
            edges: navEdges,
          },
          final,
        );

        // Persist the ticket (Supabase when signed in + configured, else demo history).
        const ticketId = newId('t');
        let fileUrl: string | undefined;
        if (pendingFile && isSupabaseConfigured && user && !user.isDemo) {
          try {
            fileUrl = await uploadTicketFile(pendingFile, user.id, ticketId);
          } catch {
            /* upload failure shouldn't block navigation */
          }
        }
        const record = {
          ...final,
          id: ticketId,
          userId: user?.id ?? 'guest',
          theatreId: matched.id,
          screenId: venueScreen?.id,
          fileUrl,
        };
        setConfirmed(record);
        if (user) {
          try {
            const savedId = await saveTicketRecord({
              id: ticketId,
              userId: user.id,
              platform: final.platform,
              movie: final.movie,
              theatre: final.theatre,
              screen: final.screen,
              showTime: final.showTime,
              row: final.row,
              seat: final.seat,
              confidence: final.confidence,
              theatreId: matched.id,
              screenId: venueScreen?.id,
              fileUrl,
            });
            setConfirmed((prev) => (prev ? { ...prev, id: savedId } : prev));
          } catch {
            /* history failure shouldn't block navigation */
          }
        }
        if (!venueScreen) {
          setMatchError("We couldn't identify the screen. Please select it manually.");
        }
        setMatchResult('found');
        return 'found';
      } catch {
        setMatchResult('error');
        setMatchError('Something went wrong while matching your theatre. Please try again.');
        return 'error';
      }
    },
    [applyVenue, pendingFile, user],
  );

  const useDemoTheatre = useCallback(async () => {
    const venue = await loadDemoDataForStore();
    if (draft) applyVenue(venue, draft);
    else if (confirmed) applyVenue(venue, confirmed);
    setMatchResult('found');
    setMatchError('');
  }, [applyVenue, confirmed, draft]);

  const selectScreen = useCallback(
    async (screenId: string) => {
      const next = screens.find((s) => s.id === screenId) ?? null;
      setScreen(next);
      if (!next) {
        setSeats([]);
        setDestSeat(null);
        return;
      }
      const seatRows = await fetchSeats(next.id);
      setSeats(seatRows);
      const basis = confirmed ?? draft;
      setDestSeat(basis ? findSeat(seatRows, basis.row, basis.seat) : null);
      setRoutePoints([]);
      setPathIds([]);
      setLegs([]);
      setStepIndex(0);
      setConfirmed((prev) => (prev ? { ...prev, screenId: next.id } : prev));
    },
    [confirmed, draft, screens],
  );

  const resumeTicket = useCallback(
    async (item: TicketListItem): Promise<void> => {
      const resumed: TicketDraft = {
        movie: item.movie,
        theatre: item.theatre,
        screen: item.screen,
        showTime: item.showTime,
        row: item.row,
        seat: item.seat,
        platform: item.platform,
        confidence: item.confidence ?? 70,
        level: (item.confidence ?? 70) >= 75 ? 'high' : 'medium',
        rawText: '',
      };
      setDraft(resumed);
      setPendingFile(null);
      const result = await confirmTicket(resumed);
      go(result === 'found' ? 'map' : 'confirm');
    },
    [confirmTicket, go],
  );

  const beginNavigation = useCallback(
    (start: string) => {
      const basis = confirmed ?? draft;
      if (!basis || !basis.row || !basis.seat) {
        notify('Confirm your seat first.');
        return;
      }
      const route = computeRouteToSeat(points, edges, seats, start, basis.row, basis.seat);
      if (!route || !route.pathIds.length || !route.legs.length) {
        notify("Couldn't calculate a route from here. Try another starting point.");
        return;
      }
      setRoutePoints(route.allPoints);
      setRouteEdges(route.allEdges);
      setPathIds(route.pathIds);
      setLegs(route.legs);
      setTotalDistance(route.totalDistance);
      setEtaMinutes(route.etaMinutes);
      setStartId(start);
      setStepIndex(0);
      setOffRoute(false);
      setDestSeat(route.destSeat);
      const ticketId = confirmed?.id;
      const uid = user?.id ?? 'guest';
      createNavSession({
        userId: isSupabaseConfigured && user && !user.isDemo ? uid : 'guest',
        ticketId,
        startingPoint: start,
        destinationSeat: route.destSeat?.id,
      })
        .then((id) => {
          sessionRef.current = id;
        })
        .catch(() => {
          sessionRef.current = undefined;
        });
      go('navigate');
    },
    [confirmed, draft, edges, go, notify, points, seats, user],
  );

  const finishArrival = useCallback(() => {
    completeNavSession(sessionRef.current).catch(() => undefined);
    go('arrival');
  }, [go]);

  const advanceStep = useCallback(() => {
    setStepIndex((prev) => {
      const next = Math.min(prev + 1, Math.max(0, pathIds.length - 1));
      if (next !== prev) {
        updateSessionPoint(sessionRef.current, pathIds[next]).catch(() => undefined);
        if (next === pathIds.length - 1) {
          window.setTimeout(finishArrival, 350);
        }
      }
      return next;
    });
    setOffRoute(false);
  }, [finishArrival, pathIds]);

  const scanCheckpoint = useCallback(
    (input: string): { ok: boolean; message: string } => {
      const basis = confirmed ?? draft;
      if (!basis) return { ok: false, message: 'Confirm your seat first.' };
      const q = input.trim().toLowerCase();
      if (!q) return { ok: false, message: 'Enter a checkpoint code.' };
      const hit = routePoints.find(
        (p) =>
          p.id.toLowerCase() === q ||
          (p.qr_code ?? '').toLowerCase() === q ||
          p.name.toLowerCase() === q,
      );
      // Also allow scanning venue points that exist but aren't on this route.
      const venueHit =
        hit ?? points.find((p) => (p.qr_code ?? '').toLowerCase() === q || p.id.toLowerCase() === q);
      if (!venueHit) {
        return { ok: false, message: "We couldn't recognize this checkpoint. Please try again." };
      }
      const idx = pathIds.indexOf(venueHit.id);
      if (idx === -1) {
        // Off route → recalculate from the scanned checkpoint.
        const route = computeRouteToSeat(points, edges, seats, venueHit.id, basis.row, basis.seat);
        if (!route || !route.pathIds.length) {
          return { ok: false, message: "Couldn't route from here. Try another checkpoint." };
        }
        setRoutePoints(route.allPoints);
        setRouteEdges(route.allEdges);
        setPathIds(route.pathIds);
        setLegs(route.legs);
        setTotalDistance(route.totalDistance);
        setEtaMinutes(route.etaMinutes);
        setStartId(venueHit.id);
        setStepIndex(0);
        setOffRoute(true);
        updateSessionPoint(sessionRef.current, venueHit.id).catch(() => undefined);
        return { ok: true, message: "You're slightly off route. Recalculating…" };
      }
      if (idx < stepIndex) {
        return { ok: true, message: `That's behind you — ${venueHit.name} is on your way back.` };
      }
      setStepIndex(idx);
      setOffRoute(false);
      updateSessionPoint(sessionRef.current, venueHit.id).catch(() => undefined);
      if (idx === pathIds.length - 1) {
        window.setTimeout(finishArrival, 350);
        return { ok: true, message: "You've arrived!" };
      }
      return { ok: true, message: `Location updated: ${venueHit.name}` };
    },
    [confirmed, draft, edges, finishArrival, pathIds, points, routePoints, seats, stepIndex],
  );

  const endNavigation = useCallback(
    (completed: boolean) => {
      if (completed) {
        finishArrival();
      } else {
        go('map');
      }
    },
    [finishArrival, go],
  );

  const resetFlow = useCallback(() => {
    setDraft(null);
    setPendingFile(null);
    setConfirmed(null);
    setTheatre(null);
    setScreens([]);
    setScreen(null);
    setSeats([]);
    setPoints([]);
    setEdges([]);
    setDestSeat(null);
    setMatchResult('idle');
    setMatchError('');
    setStartId('');
    setRoutePoints([]);
    setRouteEdges([]);
    setPathIds([]);
    setLegs([]);
    setTotalDistance(0);
    setEtaMinutes(0);
    setStepIndex(0);
    setOffRoute(false);
    sessionRef.current = undefined;
  }, []);

  const currentId = pathIds.length ? pathIds[Math.min(stepIndex, pathIds.length - 1)] : null;

  const value = useMemo<AppState>(
    () => ({
      view,
      go,
      uploadMode,
      setUploadMode,
      user,
      setUser,
      isAdmin: user?.role === 'admin',
      authReady,
      signOut,
      draft,
      setDraft,
      pendingFile,
      setPendingFile,
      confirmed,
      theatre,
      screens,
      screen,
      selectScreen,
      seats,
      points,
      edges,
      destSeat,
      matchResult,
      matchError,
      confirmTicket,
      useDemoTheatre,
      resumeTicket,
      startId,
      routePoints,
      routeEdges,
      pathIds,
      legs,
      totalDistance,
      etaMinutes,
      stepIndex,
      currentId,
      offRoute,
      beginNavigation,
      advanceStep,
      scanCheckpoint,
      endNavigation,
      toast,
      notify,
      resetFlow,
    }),
    [
      advanceStep,
      authReady,
      beginNavigation,
      confirmTicket,
      confirmed,
      currentId,
      destSeat,
      draft,
      edges,
      endNavigation,
      etaMinutes,
      go,
      isSupabaseConfigured ? 'sb' : 'demo',
      legs,
      matchError,
      matchResult,
      notify,
      offRoute,
      pathIds,
      pendingFile,
      points,
      resetFlow,
      resumeTicket,
      routeEdges,
      routePoints,
      scanCheckpoint,
      screen,
      screens,
      seats,
      selectScreen,
      signOut,
      startId,
      stepIndex,
      theatre,
      toast,
      totalDistance,
      uploadMode,
      useDemoTheatre,
      user,
      view,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
