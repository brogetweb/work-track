'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { api, clearToken, getToken, setToken, SOCKET_URL } from '@/services/api';
import { formatElapsed, SLEEP_GAP_MS } from '@/lib/format';
import type { ChatMessage, Notice, Session, User, WorkSession } from '@/types';

interface Toast {
  id: number;
  message: string;
  tone: 'ok' | 'err';
}

interface AppState {
  ready: boolean;
  user: User | null;
  permissions: string[];
  company: string;
  notes: Notice[];
  unread: number;
  chatUnread: number;
  onlineIds: string[];
  setChatUnread: (count: number) => void;
  onSocket: (event: string, handler: (payload: unknown) => void) => () => void;
  emitSocket: (event: string, payload?: unknown) => void;
  shift: WorkSession | null;
  elapsed: string;
  paused: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  can: (key: string) => boolean;
  canAny: (keys: string[]) => boolean;
  toast: (message: string, tone?: 'ok' | 'err') => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [company, setCompany] = useState('WorkTrack');
  const [notes, setNotes] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);
  const [chatUnread, setChatUnread] = useState(0);
  const [onlineIds, setOnlineIds] = useState<string[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const listenersRef = useRef(new Map<string, Set<(payload: unknown) => void>>());
  const [shift, setShift] = useState<WorkSession | null>(null);
  const [tick, setTick] = useState(() => Date.now());
  const [frozenAt, setFrozenAt] = useState<number | null>(null);
  const lastTickRef = useRef(Date.now());
  const frozenRef = useRef<number | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, tone: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((items) => [...items, { id, message, tone }]);
    setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 3800);
  }, []);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setReady(true);
      return;
    }
    try {
      const [session, notesResult, chatResult] = await Promise.all([
        api.get<Session>('/auth/me'),
        api.get<Notice[]>('/notifications?limit=6').catch(() => null),
        api.get<{ count: number }>('/chat/unread').catch(() => null),
      ]);
      const { data } = session;
      setUser(data.user);
      setPermissions(data.permissions);
      setCompany(data.company?.name || 'WorkTrack');
      setShift(data.shift || null);
      frozenRef.current = null;
      setFrozenAt(null);
      lastTickRef.current = Date.now();
      if (notesResult) {
        setNotes(notesResult.data);
        setUnread(notesResult.meta?.unread ?? 0);
      }
      if (chatResult) setChatUnread(chatResult.data.count || 0);
    } catch {
      clearToken();
      setUser(null);
      setShift(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const socket = io(SOCKET_URL, {
      auth: { token: getToken() },
    });
    socketRef.current = socket;
    const fan = (event: string, payload: unknown) => {
      listenersRef.current.get(event)?.forEach((handler) => handler(payload));
    };
    socket.on('notification', (note: Notice) => {
      setNotes((items) => [note, ...items].slice(0, 6));
      setUnread((count) => count + 1);
      toast(note.title);
    });
    socket.on('chat:message', (message: ChatMessage) => {
      fan('chat:message', message);
      if (!message.mine) {
        setChatUnread((count) => count + 1);
        if (!window.location.pathname.startsWith('/chat')) {
          toast(message.body || `${message.fromName || 'Someone'} sent a file`);
        }
      }
    });
    socket.on('chat:read', (payload: unknown) => fan('chat:read', payload));
    socket.on('chat:typing', (payload: unknown) => fan('chat:typing', payload));
    socket.on('presence:snapshot', (payload: { online?: string[] }) => {
      setOnlineIds(payload.online || []);
    });
    socket.on('presence', (payload: { userId?: string; online?: boolean; lastSeen?: string | null }) => {
      fan('presence', payload);
      if (!payload.userId) return;
      setOnlineIds((ids) => (
        payload.online
          ? (ids.includes(payload.userId as string) ? ids : [...ids, payload.userId as string])
          : ids.filter((id) => id !== payload.userId)
      ));
    });
    return () => {
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [toast, user]);

  const onSocket = useCallback((event: string, handler: (payload: unknown) => void) => {
    const set = listenersRef.current.get(event) || new Set<(payload: unknown) => void>();
    set.add(handler);
    listenersRef.current.set(event, set);
    return () => {
      set.delete(handler);
    };
  }, []);

  const emitSocket = useCallback((event: string, payload?: unknown) => {
    socketRef.current?.emit(event, payload);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<Session & { token: string }>('/auth/login', { email, password });
    setToken(data.token || '');
    setUser(data.user);
    setPermissions(data.permissions);
    setCompany(data.company?.name || 'WorkTrack');
    setShift(data.shift || null);
    frozenRef.current = null;
    setFrozenAt(null);
    lastTickRef.current = Date.now();
    setReady(true);
    const [notesResult, chatResult] = await Promise.all([
      api.get<Notice[]>('/notifications?limit=6').catch(() => null),
      api.get<{ count: number }>('/chat/unread').catch(() => null),
    ]);
    if (notesResult) {
      setNotes(notesResult.data);
      setUnread(notesResult.meta?.unread ?? 0);
    }
    if (chatResult) setChatUnread(chatResult.data.count || 0);
  }, []);

  const logout = useCallback(async () => {
    try {
      if (getToken()) await api.post('/auth/logout');
    } catch {
      // Leave anyway. The next sign-in closes any shift that is still open.
    }
    clearToken();
    setUser(null);
    setPermissions([]);
    setNotes([]);
    setUnread(0);
    setChatUnread(0);
    setOnlineIds([]);
    setShift(null);
    frozenRef.current = null;
    setFrozenAt(null);
  }, []);

  const applyShift = useCallback((next: WorkSession | null) => {
    setShift(next);
    frozenRef.current = null;
    setFrozenAt(null);
    const now = Date.now();
    lastTickRef.current = now;
    setTick(now);
  }, []);

  const pulse = useCallback(async () => {
    if (!getToken()) return;
    try {
      const { data } = await api.post<WorkSession>('/attendance/pulse');
      applyShift(data);
    } catch {
      // Keep the frozen clock. The next pulse tries again.
    }
  }, [applyShift]);

  useEffect(() => {
    if (!shift?.running || !shift.startedAt) return;
    lastTickRef.current = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      const gap = now - lastTickRef.current;
      lastTickRef.current = now;
      if (gap > SLEEP_GAP_MS) {
        const awakeUntil = now - gap;
        frozenRef.current = awakeUntil;
        setFrozenAt(awakeUntil);
        void pulse();
        return;
      }
      if (frozenRef.current == null) setTick(now);
    }, 1000);
    const beat = window.setInterval(() => { void pulse(); }, 20_000);
    const onWake = () => {
      const gap = Date.now() - lastTickRef.current;
      if (gap > SLEEP_GAP_MS) {
        frozenRef.current = lastTickRef.current;
        setFrozenAt(lastTickRef.current);
      }
      void pulse();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') onWake();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onWake);
    return () => {
      window.clearInterval(id);
      window.clearInterval(beat);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onWake);
    };
  }, [pulse, shift?.running, shift?.startedAt]);

  const paused = frozenAt != null;
  const elapsed = useMemo(() => {
    const banked = (shift?.hours || 0) * 3_600_000;
    if (!shift?.running || !shift.startedAt) return formatElapsed(banked);
    const start = new Date(shift.startedAt).getTime();
    const end = frozenAt ?? tick;
    return formatElapsed(banked + Math.max(0, end - start));
  }, [shift, tick, frozenAt]);

  const can = useCallback((key: string) => user?.role === 'super_admin' || permissions.includes(key), [permissions, user]);
  const canAny = useCallback((keys: string[]) => keys.some((key) => can(key)), [can]);

  const markRead = useCallback(async (id: string) => {
    await api.patch(`/notifications/${id}/read`);
    setNotes((items) => items.map((item) => (item.id === id ? { ...item, read: true } : item)));
    setUnread((count) => {
      const target = notes.find((item) => item.id === id);
      return target && !target.read ? Math.max(0, count - 1) : count;
    });
  }, [notes]);

  const markAllRead = useCallback(async () => {
    await api.post('/notifications/read-all');
    setNotes((items) => items.map((item) => ({ ...item, read: true })));
    setUnread(0);
  }, []);

  const value = useMemo(() => ({
    ready, user, permissions, company, notes, unread, chatUnread, onlineIds, setChatUnread, onSocket, emitSocket, shift, elapsed, paused, login, logout, refresh, can, canAny, toast, markRead, markAllRead,
  }), [ready, user, permissions, company, notes, unread, chatUnread, onlineIds, onSocket, emitSocket, shift, elapsed, paused, login, logout, refresh, can, canAny, toast, markRead, markAllRead]);

  return (
    <AppContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((item) => (
          <div key={item.id} className={`rounded-xl px-4 py-3 text-sm text-white shadow-lg ${item.tone === 'err' ? 'bg-rose-800' : 'bg-ink'}`}>
            {item.message}
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAuth must be used within AppProvider');
  return context;
}
