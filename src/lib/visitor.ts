// An anonymous id for this browser, so a like or dislike counts once and can be changed.
// It is random, says nothing about the person, and never leaves this site.
const KEY = 'elysian_visitor';

export function visitorId(): string {
  try {
    let v = localStorage.getItem(KEY);
    if (!v || !/^[A-Za-z0-9_-]{8,64}$/.test(v)) {
      v = (crypto.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, '');
      localStorage.setItem(KEY, v);
    }
    return v;
  } catch {
    return '';
  }
}
