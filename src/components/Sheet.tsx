'use client';

import { useEffect, useRef } from 'react';

interface SheetProps {
  open: boolean;
  label: string;
  onClose: () => void;
  children: React.ReactNode;
  /** CSS selector for the element to focus when the sheet opens. */
  initialFocusSelector?: string;
}

/**
 * A bottom sheet. Handles the things every sheet needs and none of them
 * should have to think about again: the backdrop, Escape to close, focus
 * moving into the sheet, focus coming back when it closes, and the page
 * behind it not scrolling.
 */
export function Sheet({
  open,
  label,
  onClose,
  children,
  initialFocusSelector,
}: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    restoreRef.current = document.activeElement as HTMLElement | null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      // Keep focus inside the sheet.
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const timer = setTimeout(() => {
      const panel = panelRef.current;
      const preferred = initialFocusSelector
        ? panel?.querySelector<HTMLElement>(initialFocusSelector)
        : null;
      const fallback = panel?.querySelector<HTMLElement>('button, input');
      // Never let focusing scroll the sheet sideways.
      (preferred ?? fallback)?.focus({ preventScroll: true });
    }, 50);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = overflow;
      clearTimeout(timer);
      restoreRef.current?.focus?.();
    };
  }, [open, onClose, initialFocusSelector]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="max-h-[92dvh] w-full max-w-md overflow-x-hidden overflow-y-auto rounded-t-3xl bg-surface px-5 pb-7 pt-3 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-surface-3" />
        {children}
      </div>
    </div>
  );
}
