'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  BadgeCheck,
  BarChart3,
  Bell,
  Building2,
  CalendarCheck,
  ClipboardList,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  MessageCircle,
  Search,
  Settings,
  Shield,
  Users,
} from 'lucide-react';
import { useAuth } from '@/context/AppContext';
import { api } from '@/services/api';
import { roleLabel } from '@/lib/format';
import { Avatar } from '@/components/ui';
import type { SearchHits } from '@/types';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, any: ['dashboard.view'] },
  { href: '/chat', label: 'Chat', icon: MessageCircle, any: null },
  { href: '/departments', label: 'Departments', icon: Building2, any: ['departments.view', 'departments.manage'] },
  { href: '/employees', label: 'Employees', icon: Users, any: ['employees.view.all', 'employees.view.department', 'employees.manage'] },
  { href: '/tasks', label: 'All Tasks', icon: ListTodo, any: ['tasks.view.all', 'tasks.view.department', 'tasks.view.own'] },
  { href: '/daily-reports', label: 'Daily Work Reports', icon: ClipboardList, any: ['reports.view.all', 'reports.view.department', 'reports.submit', 'reports.review'] },
  { href: '/productivity', label: 'Productivity Reports', icon: BarChart3, any: ['analytics.view'] },
  { href: '/attendance', label: 'Attendance', icon: CalendarCheck, any: ['attendance.view.all', 'attendance.view.department', 'attendance.mark'] },
  { href: '/approvals', label: 'Approvals', icon: BadgeCheck, any: ['approvals.review'] },
  { href: '/notifications', label: 'Notifications', icon: Bell, any: ['notifications.view'] },
  { href: '/roles', label: 'Roles & Permissions', icon: Shield, any: ['roles.manage'] },
  { href: '/settings', label: 'Settings', icon: Settings, any: null },
];

function Loader() {
  return (
    <div className="grid min-h-screen place-items-center bg-paper">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-line border-t-accent" />
        <p className="mt-3 text-sm text-muted">Opening WorkTrack…</p>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { ready, user, company, canAny, logout, notes, unread, chatUnread, markRead, elapsed, shift, paused } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [panel, setPanel] = useState(false);
  const [shown, setShown] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHits | null>(null);
  const [bell, setBell] = useState(false);

  useEffect(() => {
    if (ready && !user) router.replace('/login');
  }, [ready, router, user]);

  useEffect(() => {
    setShown(false);
    const timer = window.setTimeout(() => setPanel(false), 220);
    setBell(false);
    setHits(null);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  function openMenu() {
    setPanel(true);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setShown(true));
    });
  }

  function closeMenu() {
    setShown(false);
    window.setTimeout(() => setPanel(false), 220);
  }

  useEffect(() => {
    if (query.trim().length < 2) {
      setHits(null);
      return;
    }
    const timer = setTimeout(() => {
      api.get<SearchHits>(`/search?q=${encodeURIComponent(query.trim())}`)
        .then((result) => setHits(result.data))
        .catch(() => setHits({ tasks: [], employees: [], reports: [] }));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  if (!ready || !user) return <Loader />;

  const items = NAV.filter((item) => !item.any || canAny(item.any)).map((item) => ({
    ...item,
    label: item.href === '/tasks'
      ? (user.role === 'super_admin' ? 'All Tasks' : user.role === 'team_leader' ? 'Team Tasks' : 'My Tasks')
      : item.href === '/daily-reports'
        ? (user.role === 'super_admin' ? 'All Reports' : user.role === 'team_leader' ? 'Team Reports' : 'My Reports')
        : item.label,
  }));

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-stone-100">
      <div className="px-5 pb-4 pt-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-base font-bold text-white shadow-lg shadow-teal-950/40">W</span>
          <div>
            <p className="font-serif text-2xl leading-none text-white">WorkTrack</p>
            <p className="mt-1 text-[11px] font-semibold tracking-wide text-white/45">{company}</p>
          </div>
        </div>
      </div>
      <nav className="sidebar-scroll flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-3 pb-4">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-[background-color,color,box-shadow] duration-200 ease-out ${active ? 'bg-white/10 font-semibold text-white shadow-[inset_3px_0_0_#2dd4bf]' : 'text-white/65 hover:bg-white/10 hover:text-white'}`}
            >
              <Icon size={17} />
              <span className="flex-1">{item.label}</span>
              {item.href === '/notifications' && unread > 0 && (
                <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-white">{unread}</span>
              )}
              {item.href === '/chat' && chatUnread > 0 && (
                <span className="rounded-full bg-emerald-400 px-2 py-0.5 text-[11px] font-bold text-emerald-950">{chatUnread}</span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <Avatar name={user.name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user.name}</p>
            <p className="truncate text-xs text-white/45">{roleLabel(user.role)}</p>
          </div>
        </div>
        <button
          className="mt-1 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-white/70 transition-colors duration-200 ease-out hover:bg-white/10 hover:text-white"
          onClick={() => { void logout().finally(() => router.replace('/login')); }}
          type="button"
        >
          <LogOut size={16} />
          Log out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-paper xl:grid xl:grid-cols-[272px_1fr]">
      <aside className="sticky top-0 hidden h-screen xl:block">{sidebar}</aside>
      {panel && (
        <div className="fixed inset-0 z-40 xl:hidden">
          <button className={`absolute inset-0 bg-ink/50 transition-opacity duration-200 ease-out ${shown ? 'opacity-100' : 'opacity-0'}`} aria-label="Close menu" onClick={closeMenu} type="button" />
          <div className={`relative h-full w-[min(300px,88vw)] shadow-2xl transition-transform duration-200 ease-out ${shown ? 'translate-x-0' : '-translate-x-full'}`}>{sidebar}</div>
        </div>
      )}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-line bg-paper/95 px-3 py-2.5 backdrop-blur sm:px-5">
          <div className="flex items-center gap-2 sm:gap-3">
          <button className="rounded-xl p-2 transition-colors duration-200 hover:bg-black/5 xl:hidden" onClick={openMenu} type="button" aria-label="Open menu">
            <Menu size={20} />
          </button>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
            <input
              className="w-full rounded-2xl border border-line bg-white py-2.5 pl-9 pr-3 text-sm outline-none ring-accent/20 focus:ring-4 sm:py-3 sm:pl-10 sm:text-[15px]"
              placeholder="Search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {hits && (
              <div className="absolute z-20 mt-2 w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-card shadow-xl">
                <SearchGroup title="Tasks" empty="No matching tasks">
                  {hits.tasks.map((task) => (
                    <Link key={task.id} href={`/tasks/${task.id}`} className="block px-3 py-2 text-sm hover:bg-stone-50" onClick={() => setQuery('')}>
                      {task.title}
                    </Link>
                  ))}
                </SearchGroup>
                <SearchGroup title="People" empty="No matching people">
                  {hits.employees.map((person) => (
                    <Link key={person.id} href="/employees" className="block px-3 py-2 text-sm hover:bg-stone-50" onClick={() => setQuery('')}>
                      {person.name} · {person.employeeCode}
                    </Link>
                  ))}
                </SearchGroup>
                <SearchGroup title="Reports" empty="No matching reports">
                  {hits.reports.map((report) => (
                    <Link key={report.id} href={`/daily-reports/${report.id}`} className="block px-3 py-2 text-sm hover:bg-stone-50" onClick={() => setQuery('')}>
                      {report.employee?.name || 'Report'} · {report.date}
                    </Link>
                  ))}
                </SearchGroup>
              </div>
            )}
          </div>
          <button
            className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-2xl border border-line bg-white px-2.5 py-2.5 text-sm font-semibold text-ink hover:bg-stone-50 sm:px-3"
            onClick={() => { void logout().finally(() => router.replace('/login')); }}
            type="button"
            aria-label="Log out"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Log out</span>
          </button>
          <div className="grid shrink-0 grid-cols-[auto_auto] border border-[#b4b4b4] bg-white text-ink" title={paused ? 'Paused while the laptop was asleep' : shift?.running ? 'Live. Sleep pauses the clock.' : 'Off duty'}>
            <span className={`border-r border-[#b4b4b4] px-2 py-1 text-xs font-bold ${paused ? 'bg-amber-300 text-amber-950' : shift?.running ? 'bg-emerald-300 text-emerald-950' : 'bg-stone-200 text-stone-700'}`}>{paused ? 'Paused' : shift?.running ? 'Live' : 'Off'}</span>
            <span className="px-2 py-1 text-sm font-bold tabular-nums">{elapsed}</span>
          </div>
          <div className="relative shrink-0">
            <button className="relative rounded-2xl border border-line bg-white p-2.5 sm:p-3" onClick={() => setBell((value) => !value)} type="button" aria-label="Notifications">
              <Bell size={18} />
              {unread > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-700 px-1 text-[11px] font-bold text-white">{unread}</span>}
            </button>
            {bell && (
              <div className="absolute right-0 z-20 mt-2 w-80 max-w-[80vw] rounded-2xl border border-line bg-card p-2 shadow-xl">
                {notes.length === 0 && <p className="px-3 py-4 text-sm text-muted">No notifications yet.</p>}
                {notes.map((note) => (
                  <button
                    key={note.id}
                    className="block w-full rounded-xl px-3 py-2 text-left hover:bg-stone-50"
                    type="button"
                    onClick={() => {
                      void markRead(note.id);
                      setBell(false);
                      if (note.link) router.push(note.link);
                    }}
                  >
                    <p className={`text-sm ${note.read ? 'text-muted' : 'font-semibold text-ink'}`}>{note.title}</p>
                    <p className="text-xs text-muted">{note.message}</p>
                  </button>
                ))}
                <Link href="/notifications" className="block px-3 py-2 text-center text-xs font-semibold text-accent" onClick={() => setBell(false)}>
                  See all
                </Link>
              </div>
            )}
          </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] px-3 py-5 sm:px-5 sm:py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function SearchGroup({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const list = Array.isArray(children) ? children : [children];
  const visible = list.filter(Boolean);
  return (
    <div className="border-b border-line px-2 py-2 last:border-b-0">
      <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted">{title}</p>
      {visible.length ? visible : <p className="px-2 py-1 text-xs text-muted">{empty}</p>}
    </div>
  );
}
