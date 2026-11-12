import type { AppState, Exercise, Session, Settings } from '@/lib/types';

export class UnauthorizedError extends Error {
  constructor() {
    super('unauthorized');
    this.name = 'UnauthorizedError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });

  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) throw new Error(`request failed: ${res.status}`);

  return res.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ ok: true }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
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
};
