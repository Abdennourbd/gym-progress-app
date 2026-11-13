import type { AppState, Exercise, Session, Settings } from '@/lib/types';

export class UnauthorizedError extends Error {
  constructor() {
    super('unauthorized');
    this.name = 'UnauthorizedError';
  }
}

/** A failure that carries the status, so the screen can say what went wrong. */
export class ApiError extends Error {
  status: number;
  body: { error?: string; issue?: string } | null;

  constructor(status: number, body: { error?: string; issue?: string } | null) {
    super(`request failed: ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });

  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(
      res.status,
      body && typeof body === 'object' ? (body as { error?: string; issue?: string }) : null,
    );
  }

  return res.json() as Promise<T>;
}

export interface AuthUser {
  id: string;
  username: string;
}

export const api = {
  signup: (username: string, password: string, confirmPassword: string, inviteCode?: string) =>
    request<{ ok: true; user: AuthUser }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ username, password, confirmPassword, inviteCode }),
    }),
  login: (username: string, password: string) =>
    request<{ ok: true; user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  demoLogin: () =>
    request<{ ok: true; user: AuthUser }>('/api/auth/demo', { method: 'POST' }),
  logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
  fetchSession: () => request<{ authenticated: boolean; user: AuthUser | null }>('/api/auth/session'),
  fetchConfig: () => request<{ inviteRequired: boolean }>('/api/auth/config'),
  fetchState: () => request<AppState>('/api/state'),
  putExercises: (exercises: Exercise[]) =>
    request<{ ok: true }>('/api/exercises', {
      method: 'PUT',
      body: JSON.stringify({ exercises }),
    }),
  putExercise: (exercise: Exercise) =>
    request<{ ok: true }>(`/api/exercises/${exercise.id}`, {
      method: 'PUT',
      body: JSON.stringify(exercise),
    }),
  putSession: (session: Session) =>
    request<{ ok: true }>(`/api/sessions/${session.id}`, {
      method: 'PUT',
      body: JSON.stringify(session),
    }),
  putSessions: (sessions: Session[]) =>
    request<{ ok: true }>('/api/sessions', {
      method: 'PUT',
      body: JSON.stringify({ sessions }),
    }),
  deleteSession: (id: string) =>
    request<{ ok: true }>(`/api/sessions/${id}`, { method: 'DELETE' }),
  putSettings: (settings: Settings) =>
    request<{ ok: true }>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
  deleteAccount: (password: string) =>
    request<{ ok: true }>('/api/account', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    }),
};
