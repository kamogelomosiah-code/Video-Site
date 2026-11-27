import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Hash, LayoutGrid, Search, X } from 'lucide-react';
import type { PublicVideo } from '../../shared/types';
import { api } from '../lib/api';
import { useDebounced } from '../lib/utils';
import { categoryPath, tagPath, videoPath } from '../../shared/seo';
import { Thumb } from './Media';
import { cx } from './ui';

type Suggest = { videos: PublicVideo[]; tags: { tag: string; count: number }[]; categories: { slug: string; name: string }[] };
type Option = { key: string; to: string; kind: 'search' | 'video' | 'tag' | 'category'; label: string; video?: PublicVideo; extra?: string };

/**
 * The site search box. As you type it suggests videos, tags and categories; Enter (or the button)
 * shows every result. Works with the keyboard (↑ ↓ Enter Esc) and with touch.
 */
export default function SiteSearch({ variant = 'header', autoFocus, onDone }: { variant?: 'header' | 'hero'; autoFocus?: boolean; onDone?: () => void }) {
  const nav = useNavigate();
  const loc = useLocation();
  const listId = useId();
  const [q, setQ] = useState(() => new URLSearchParams(loc.search).get('q') || '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [data, setData] = useState<Suggest | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const typed = useDebounced(q.trim(), 180);

  // Keep the box in step with the address (?q=…), e.g. after Back.
  useEffect(() => setQ(new URLSearchParams(loc.search).get('q') || ''), [loc.search]);
  useEffect(() => {
    if (typed.length < 2) return setData(null);
    let alive = true;
    api.get<Suggest>(`/search/suggest?q=${encodeURIComponent(typed)}`).then((r) => alive && setData(r)).catch(() => {});
    return () => { alive = false; };
  }, [typed]);
  useEffect(() => {
    const close = (e: PointerEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  const options: Option[] = [];
  if (q.trim()) options.push({ key: 's', to: `/?q=${encodeURIComponent(q.trim())}`, kind: 'search', label: `Search for “${q.trim()}”` });
  if (data && q.trim().length >= 2) {
    data.videos.forEach((v) => options.push({ key: `v${v.id}`, to: videoPath(v), kind: 'video', label: v.title, video: v }));
    data.tags.forEach((t) => options.push({ key: `t${t.tag}`, to: tagPath(t.tag), kind: 'tag', label: `#${t.tag}`, extra: `${t.count} video${t.count === 1 ? '' : 's'}` }));
    data.categories.forEach((c) => options.push({ key: `c${c.slug}`, to: categoryPath(c.slug), kind: 'category', label: c.name, extra: 'Category' }));
  }
  const show = open && q.trim().length >= 2 && options.length > 1;

  const go = (to: string) => {
    setOpen(false);
    setActive(-1);
    input.current?.blur();
    nav(to);
    onDone?.();
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (show && active >= 0 && options[active]) return go(options[active].to);
    go(q.trim() ? `/?q=${encodeURIComponent(q.trim())}` : '/');
  };

  const hero = variant === 'hero';
  return (
    <div ref={box} className="relative w-full" data-testid={`site-search-${variant}`}>
      <form onSubmit={submit} role="search" className="relative">
        <Search className={cx('pointer-events-none absolute top-1/2 -translate-y-1/2 text-zinc-500', hero ? 'left-4 h-5 w-5' : 'left-3.5 h-4 w-4')} />
        <input
          ref={input}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && show) { e.preventDefault(); setActive((a) => Math.min(options.length - 1, a + 1)); }
            else if (e.key === 'ArrowUp' && show) { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); }
            else if (e.key === 'Escape') { setOpen(false); setActive(-1); }
          }}
          placeholder="Search videos, tags, creators…"
          aria-label="Search the site"
          role="combobox"
          aria-expanded={show}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={show && active >= 0 ? `${listId}-${active}` : undefined}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          autoFocus={autoFocus}
          className={cx(
            'w-full rounded-full border bg-zinc-900 text-white placeholder:text-zinc-500 transition-colors duration-200 ease-standard focus:border-brand-500/70 focus:outline-none [&::-webkit-search-cancel-button]:hidden',
            hero ? 'h-12 border-zinc-800 pl-12 pr-24 text-base focus:ring-2 focus:ring-brand-500/25' : 'h-11 border-transparent pl-10 pr-20 text-sm hover:bg-zinc-800/80',
          )}
        />
        {q && (
          <button type="button" onClick={() => { setQ(''); setData(null); input.current?.focus(); }} aria-label="Clear search" className={cx('ripple absolute top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-zinc-400 hover:text-white', hero ? 'right-12' : 'right-10')}>
            <X className="h-4 w-4" />
          </button>
        )}
        <button type="submit" aria-label="Search" className={cx('ripple absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full bg-brand-500 text-zinc-950 transition-colors hover:bg-brand-400', hero ? 'h-9 w-9' : 'h-8 w-8')}>
          <Search className={hero ? 'h-[18px] w-[18px]' : 'h-4 w-4'} strokeWidth={2.4} />
        </button>
      </form>

      {show && (
        <ul id={listId} role="listbox" aria-label="Suggestions" className="absolute inset-x-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950/98 p-1.5 shadow-2xl shadow-black/60 backdrop-blur-xl animate-fade-in" data-testid="search-suggestions">
          {options.map((o, i) => (
            <li key={o.key} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()} // keep the box focused until the tap lands
                onClick={() => go(o.to)}
                onMouseEnter={() => setActive(i)}
                className={cx('ripple flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm', i === active ? 'bg-white/[.07]' : 'hover:bg-white/[.04]')}
              >
                {o.kind === 'video' && o.video ? (
                  <Thumb src={o.video.thumbnailUrl} focus={o.video.thumbFocus} alt="" className="h-9 w-16 shrink-0 rounded-md" />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-zinc-400">
                    {o.kind === 'search' ? <Search className="h-4 w-4" /> : o.kind === 'tag' ? <Hash className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className={cx('line-clamp-1', o.kind === 'search' ? 'font-semibold text-white' : 'text-zinc-200')}>{o.label}</span>
                  {(o.extra || o.video?.creatorName) && <span className="block truncate text-xs text-zinc-500">{o.extra || o.video?.creatorName}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
