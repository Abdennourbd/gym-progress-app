/**
 * Where everything lives.
 *
 * Every account gets its own namespace, so one account can never read or
 * write another one's data. The id inside the key is opaque: it is generated
 * when the account is made and never changes, so a username can never be
 * forged into somebody else's namespace.
 */

export function userRecordKey(username: string): string {
  return `gym:v1:user:${username}`;
}

export function userKeys(userId: string): {
  exercises: string;
  sessions: string;
  settings: string;
  session: (id: string) => string;
} {
  const base = `gym:v1:u:${userId}`;
  return {
    exercises: `${base}:exercises`,
    sessions: `${base}:sessions`,
    settings: `${base}:settings`,
    session: (id: string) => `${base}:sessions:${id}`,
  };
}

/**
 * The keys the app used before accounts existed. Nothing reads them any more.
 * They are kept so an old dataset can still be found and copied.
 */
export const LEGACY_KEYS = {
  exercises: 'gym:v1:exercises',
  sessions: 'gym:v1:sessions',
  settings: 'gym:v1:settings',
  session: (id: string) => `gym:v1:sessions:${id}`,
};
