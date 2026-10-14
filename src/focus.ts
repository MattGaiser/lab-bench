import type { FocusEvent } from 'react';

/** Native focus scrolling cannot account for a footer painted over the content. */
export function revealAboveFooter(event: FocusEvent<HTMLElement>, footerSelector: string) {
  const target = event.target;
  const footer = event.currentTarget.querySelector(footerSelector);
  if (!(target instanceof HTMLElement) || !footer || footer.contains(target)) return;
  requestAnimationFrame(() => {
    if (!target.isConnected || document.activeElement !== target) return;
    const bounds = target.getBoundingClientRect();
    if (bounds.bottom > footer.getBoundingClientRect().top - 12 || bounds.top < 16)
      target.scrollIntoView({ block: 'center' });
  });
}
