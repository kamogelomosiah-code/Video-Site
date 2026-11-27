import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, Search, Shield, User as UserIcon, X } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useSettings } from '../lib/settings';
import AgeGate from './AgeGate';
import ConsentBar from './ConsentBar';
import { AdSlot } from './Media';
import { cx } from './ui';

const NAV = [{ to: '/', label: 'Videos', end: true }];

export function Logo() {
  const { settings } = useSettings();
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2" aria-label={`${settings.siteName} home`}>
      <img src="/peach-svgrepo-com.svg" alt="" className="h-8 w-8" />
      <span className="text-lg font-bold tracking-tight">{settings.siteName}</span>
    </Link>
  );
}

function SearchBox({ onDone }: { onDone?: () => void }) {
  const navigate = useNavigate();
  const loc = useLocation();
  const [q, setQ] = useState(() => new URLSearchParams(loc.search).get('q') || '');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(q.trim() ? `/?q=${encodeURIComponent(q.trim())}` : '/');
    onDone?.();
  };
  return (
    <form onSubmit={submit} role="search" className="relative w-full">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search videos, tags, creators…"
        aria-label="Search"
        className="w-full rounded-full border border-zinc-800 bg-zinc-900 py-2 pl-9 pr-4 text-sm placeholder:text-zinc-500 focus:border-brand-500 focus:outline-none"
      />
    </form>
  );
}

function AccountMenu() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  if (!user) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <Link to="/login" className="rounded-lg px-3 py-2 text-sm text-zinc-300 hover:text-white">Sign in</Link>
        <Link to="/register" className="hidden rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-brand-400 sm:block">
          Join
        </Link>
      </div>
    );
  }
  const initial = (user.name || '?').charAt(0).toUpperCase();
  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full p-1 pr-3 hover:bg-zinc-800"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-zinc-950">{initial}</span>
        )}
        <span className="hidden max-w-32 truncate text-sm sm:block">{user.name}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 py-1 shadow-xl animate-fade-in">
          {isAdmin && (
            <Link role="menuitem" to="/admin" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-brand-400 hover:bg-zinc-900">
              <Shield className="h-4 w-4" /> Admin panel
            </Link>
          )}
          <Link role="menuitem" to="/account" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-zinc-900">
            <UserIcon className="h-4 w-4" /> My account
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={async () => {
              setOpen(false);
              await logout();
              navigate('/');
            }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-zinc-900"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function Announcement() {
  const { settings } = useSettings();
  const [hidden, setHidden] = useState(false);
  const text = settings.announcementBanner.trim();
  useEffect(() => setHidden(false), [text]);
  if (!text || hidden) return null;
  const link = settings.announcementLink;
  const isExternal = /^https?:/i.test(link);
  return (
    <div className="relative bg-brand-500 px-10 py-2 text-center text-sm font-medium text-zinc-950" data-testid="announcement">
      {link ? (
        isExternal ? (
          <a href={link} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{text}</a>
        ) : (
          <Link to={link} className="underline underline-offset-2">{text}</Link>
        )
      ) : (
        text
      )}
      <button type="button" onClick={() => setHidden(true)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 hover:bg-black/10" aria-label="Dismiss announcement">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function Footer() {
  const { settings } = useSettings();
  return (
    <footer className="mt-16 border-t border-zinc-900 px-4 py-10 text-sm text-zinc-500">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p>{settings.footerText || `© ${new Date().getFullYear()} ${settings.siteName}. All rights reserved.`}</p>
          <p className="mt-1 text-xs text-zinc-600">All models were 18 years of age or older at the time of depiction.</p>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Legal">
          <Link to="/privacy" className="hover:text-zinc-300">Privacy</Link>
          <Link to="/terms" className="hover:text-zinc-300">Terms</Link>
          {settings.contactEmail && <a href={`mailto:${settings.contactEmail}`} className="hover:text-zinc-300">Contact</a>}
        </nav>
      </div>
    </footer>
  );
}

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo(0, 0);
  }, [loc.pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <AgeGate />
      <Announcement />
      <header className="sticky top-0 z-40 border-b border-zinc-900 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
          <button type="button" className="rounded-md p-2 hover:bg-zinc-800 md:hidden" onClick={() => setMobileOpen((o) => !o)} aria-label="Menu" aria-expanded={mobileOpen}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) => cx('rounded-lg px-3 py-2 text-sm', isActive ? 'text-white' : 'text-zinc-400 hover:text-white')}
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="mx-auto hidden w-full max-w-md md:block">
            <SearchBox />
          </div>
          <div className="ml-auto md:ml-0">
            <AccountMenu />
          </div>
        </div>
        {mobileOpen && (
          <div className="space-y-3 border-t border-zinc-900 px-4 py-4 md:hidden">
            <SearchBox onDone={() => setMobileOpen(false)} />
            <nav className="flex flex-col" aria-label="Main mobile">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx('rounded-lg px-3 py-2.5', isActive ? 'bg-zinc-900 text-white' : 'text-zinc-400')}>
                  {n.label}
                </NavLink>
              ))}
            </nav>
          </div>
        )}
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <div className="mx-auto w-full max-w-3xl px-4">
        <AdSlot slot="footer" />
      </div>
      <Footer />
      <ConsentBar />
    </div>
  );
}
