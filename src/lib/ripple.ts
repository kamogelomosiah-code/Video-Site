// Material-style touch feedback: a soft circle grows from where you press.
// Any element with the class "ripple" gets it (one listener for the whole page, nothing to wire up).
export function installRipple() {
  if (typeof window === 'undefined' || (window as any).__ripple) return;
  (window as any).__ripple = true;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (reduce.matches || e.button !== 0) return;
      const el = (e.target as Element | null)?.closest?.('.ripple') as HTMLElement | null;
      if (!el || el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') return;
      const r = el.getBoundingClientRect();
      const size = Math.hypot(Math.max(e.clientX - r.left, r.right - e.clientX), Math.max(e.clientY - r.top, r.bottom - e.clientY)) * 2;
      const dot = document.createElement('span');
      dot.className = 'ripple-dot';
      dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
      el.appendChild(dot);
      const done = () => {
        dot.classList.add('ripple-out');
        setTimeout(() => dot.remove(), 400);
        window.removeEventListener('pointerup', done);
        window.removeEventListener('pointercancel', done);
      };
      window.addEventListener('pointerup', done);
      window.addEventListener('pointercancel', done);
      setTimeout(done, 1200); // never leave one behind
    },
    { passive: true },
  );
}
