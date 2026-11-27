import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Flame, Home as HomeIcon, LogOut, Search, Shield, User as UserIcon, X } from 'lucide-react';
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

function SearchBox({ onDone, autoFocus }: { onDone?: () => void; autoFocus?: boolean }) {
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
        type="search"
        enterKeyHint="search"
        autoFocus={autoFocus}
        className="h-11 w-full rounded-full border border-transparent bg-zinc-900 pl-9 pr-4 text-sm transition-colors duration-200 ease-standard placeholder:text-zinc-500 hover:bg-zinc-800/80 focus:border-brand-500/60 focus:bg-zinc-900 focus:outline-none"
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

/**
 * The Material navigation bar for phones: four destinations, a pill behind the active one.
 * It slides away while you scroll down to read, and comes back as soon as you scroll up.
 */
function BottomNav({ onSearch, searchOpen }: { onSearch: () => void; searchOpen: boolean }) {
  const { user } = useAuth();
  const loc = useLocation();
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) < 8) return;
      setHidden(y > last && y > 120);
      last = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const onHome = loc.pathname === '/';
  const items = [
    { key: 'home', label: 'Home', icon: HomeIcon, to: '/', active: onHome && loc.hash !== '#trending' && !searchOpen },
    { key: 'search', label: 'Search', icon: Search, active: searchOpen },
    { key: 'trending', label: 'Trending', icon: Flame, to: '/#trending', active: onHome && loc.hash === '#trending' && !searchOpen },
    { key: 'you', label: user ? 'You' : 'Sign in', icon: UserIcon, to: user ? '/account' : '/login', active: ['/account', '/login', '/register'].includes(loc.pathname) && !searchOpen },
  ];
  return (
    <nav
      aria-label="Main"
      data-testid="bottom-nav"
      className={cx(
        'fixed inset-x-0 bottom-0 z-[120] border-t border-white/5 bg-zinc-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl transition-transform duration-300 ease-emphasized md:hidden',
        hidden && !searchOpen && 'translate-y-full',
      )}
    >
      <ul className="mx-auto grid h-20 max-w-md grid-cols-4">
        {items.map(({ key, label, icon: Icon, to, active }) => {
          const inner = (
            <>
              <span className={cx('flex h-8 w-16 items-center justify-center rounded-full transition-[background-color,width] duration-300 ease-emphasized', active ? 'bg-brand-500/20 text-brand-300' : 'text-zinc-400')}>
                <Icon className={cx('h-[22px] w-[22px]', active && 'animate-pop')} strokeWidth={active ? 2.4 : 2} />
              </span>
              <span className={cx('text-xs', active ? 'font-semibold text-zinc-100' : 'text-zinc-400')}>{label}</span>
            </>
          );
          const cls = 'ripple flex h-full w-full flex-col items-center justify-center gap-1 rounded-2xl';
          return (
            <li key={key} className="flex">
              {to ? (
                <Link to={to} className={cls} aria-current={active ? 'page' : undefined}>{inner}</Link>
              ) : (
                <button type="button" onClick={onSearch} className={cls} aria-expanded={searchOpen}>{inner}</button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default function Layout() {
  const [searchOpen, setSearchOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => {
    setSearchOpen(false);
    if (!loc.hash) window.scrollTo(0, 0);
  }, [loc.pathname, loc.search]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-screen flex-col">
      <AgeGate />
      <Announcement />
      <header className="sticky top-0 z-40 border-b border-white/5 bg-zinc-950/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) => cx('ripple rounded-full px-4 py-2 text-sm transition-colors', isActive ? 'bg-white/[.06] text-white' : 'text-zinc-400 hover:bg-white/[.04] hover:text-white')}
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
        {searchOpen && (
          <div className="flex items-center gap-2 border-t border-white/5 px-4 py-3 animate-fade-in md:hidden" data-testid="mobile-search">
            <SearchBox autoFocus onDone={() => setSearchOpen(false)} />
            <button type="button" onClick={() => setSearchOpen(false)} className="ripple flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-white/[.06]" aria-label="Close search">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
      </header>
      {/* Each page rises in as you arrive (keyed by the address, so search typing doesn't re-animate). */}
      <main key={loc.pathname} className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 animate-page">
        <Outlet />
      </main>
      <div className="mx-auto w-full max-w-3xl px-4">
        <AdSlot slot="footer" />
      </div>
      <Footer />
      {/* room for the phone navigation bar */}
      <div className="h-[calc(80px+env(safe-area-inset-bottom))] md:hidden" aria-hidden />
      <BottomNav searchOpen={searchOpen} onSearch={() => { setSearchOpen((o) => !o); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
      <ConsentBar />
    </div>
  );
}
