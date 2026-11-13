/**
 * Shows the "rest is over" alert as a real phone notification, routed through
 * the service worker so it vibrates on Android even when the page itself is
 * in the background.
 */

export async function notifyRestDone(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  const options = {
    body: 'Time for your next set.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'rest-timer',
    vibrate: [200, 100, 200, 100, 200],
    renotify: true,
  } as unknown as NotificationOptions;

  // Android Chrome refuses the constructor; the service worker has to put it
  // up. The constructor is the fallback for platforms that allow it.
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.showNotification('Rest timer done', options);
        return true;
      }
    }
  } catch {
    // Fall through to the constructor.
  }

  try {
    new Notification('Rest timer done', options);
    return true;
  } catch {
    return false;
  }
}

/** Asks for permission inside a user gesture; no-op if already decided. */
export function ensureNotificationPermission(): void {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'default') return;
  void Notification.requestPermission().catch(() => undefined);
}
