'use client';

import { useCallback, useEffect, useState } from 'react';
import { LoginScreen } from './LoginScreen';
import { api, type AuthUser } from '@/lib/client/api';
import { useStore } from '@/lib/client/store';
import { hasLocalData } from '@/lib/client/db';
import {
  forgetUser,
  lastUser,
  markSignedIn,
  markSignedOut,
  rememberUser,
  wasSignedIn,
  UNAUTHORIZED_EVENT,
} from '@/lib/client/auth-state';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'in' | 'out'>('checking');

  const signedIn = useCallback((next: AuthUser) => {
    rememberUser({ id: next.id, username: next.username });
    markSignedIn(next.id);
    useStore.getState().setUser({ id: next.id, username: next.username });
    setStatus('in');
  }, []);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await api.fetchSession();
        if (cancelled) return;

        if (res.authenticated && res.user) {
          signedIn(res.user);
        } else {
          setStatus('out');
        }
      } catch {
        if (cancelled) return;
        // No network. If this device already holds that account's data it was
        // signed in before, so let the app run on what is here rather than
        // locking the user out mid-workout.
        const last = lastUser();
        if (last && ((await hasLocalData(last.id)) || wasSignedIn(last.id))) {
          markSignedIn(last.id);
          useStore.getState().setUser({ id: last.id, username: last.username });
          useStore.getState().setSyncState('offline');
          setStatus('in');
        } else {
          setStatus('out');
        }
      }
    };

    void check();
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  // The server says the session is gone. Lock, even if we are offline.
  useEffect(() => {
    const onUnauthorized = () => {
      const last = lastUser();
      if (last) markSignedOut(last.id);
      forgetUser();
      useStore.getState().reset();
      setStatus('out');
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  // Two hours of inactivity ends the session locally too, so the lock screen
  // appears without needing a round trip.
  useEffect(() => {
    if (status !== 'in') return;
    let timer: ReturnType<typeof setTimeout>;

    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setStatus('out'), 2 * 60 * 60 * 1000);
    };

    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [status]);

  if (status === 'checking') {
    return (
      <div className="flex min-h-dvh items-center justify-center text-ink-faint">
        <span className="animate-pulse">Loading…</span>
      </div>
    );
  }

  if (status === 'out') {
    return <LoginScreen onSignedIn={signedIn} />;
  }

  return <>{children}</>;
}
