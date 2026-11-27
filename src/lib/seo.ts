// Keeps the page's title, description, canonical address and robots rule right as people move around the app.
// The server already sends these with the first page; this keeps them correct after in-app navigation
// (Google renders JavaScript too, and the browser tab title should always match the page).
import { useEffect } from 'react';
import { useSettings } from './settings';

function setMeta(attr: 'name' | 'property', key: string, value?: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!value) return el?.remove();
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = value;
}

export function useSeo(o: { title?: string; description?: string; path?: string; noindex?: boolean; image?: string; category?: string }) {
  const { settings: s } = useSettings();
  useEffect(() => {
    // Same rule as the server (server/seo.ts): short video titles get their category added.
    const title = o.title
      ? o.category && o.title.length + o.category.length + s.siteName.length < 52
        ? `${o.title} – ${o.category} video – ${s.siteName}`
        : `${o.title} – ${s.siteName}`
      : s.metaTitle || `${s.siteName} – ${s.heroHeadline}`;
    const description = o.description ?? s.metaDescription;
    document.title = title;
    setMeta('name', 'description', description);
    setMeta('name', 'robots', o.noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large');
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    if (o.image) setMeta('property', 'og:image', o.image);
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (o.path && !o.noindex) {
      if (!link) {
        link = document.createElement('link');
        link.rel = 'canonical';
        document.head.appendChild(link);
      }
      link.href = window.location.origin + o.path;
      setMeta('property', 'og:url', link.href);
    } else link?.remove();
  }, [o.title, o.category, o.description, o.path, o.noindex, o.image, s.siteName, s.metaTitle, s.metaDescription, s.heroHeadline]);
}
