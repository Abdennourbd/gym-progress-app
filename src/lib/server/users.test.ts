import { describe, expect, it } from 'vitest';
import {
  checkPassword,
  createUser,
  findUser,
  normalizeUsername,
  validatePassword,
  validateUsername,
} from './users';

describe('username', () => {
  it('lowercases and trims', () => {
    expect(normalizeUsername('  Amina ')).toBe('amina');
  });

  it('accepts letters, digits, underscore and dash', () => {
    expect(validateUsername('amina_2')).toBeNull();
    expect(validateUsername('a-b')).toBeNull();
  });

  it('rejects short names', () => {
    expect(validateUsername('ab')).not.toBeNull();
  });

  it('rejects long names', () => {
    expect(validateUsername('a'.repeat(25))).not.toBeNull();
  });

  it('rejects anything else', () => {
    expect(validateUsername('has space')).not.toBeNull();
    expect(validateUsername('email@example.com')).not.toBeNull();
    expect(validateUsername('')).not.toBeNull();
  });
});

describe('password', () => {
  it('wants at least eight characters', () => {
    expect(validatePassword('1234567')).not.toBeNull();
    expect(validatePassword('12345678')).toBeNull();
  });
});

describe('the account registry', () => {
  const unique = () => Math.random().toString(36).slice(2, 10);

  it('makes an account and finds it again', async () => {
    const username = `user_${unique()}`;
    const user = await createUser(username, 'a-good-password');

    expect(user).not.toBeNull();
    expect(user?.username).toBe(username);
    expect(user?.id).toBeTruthy();

    const found = await findUser(username);
    expect(found?.id).toBe(user?.id);
  });

  it('finds an account whatever case it was typed in', async () => {
    const username = `user_${unique()}`;
    const user = await createUser(username, 'a-good-password');

    const found = await findUser(username.toUpperCase());
    expect(found?.id).toBe(user?.id);
  });

  it('refuses a name that is taken', async () => {
    const username = `user_${unique()}`;
    await createUser(username, 'a-good-password');

    expect(await createUser(username, 'another-password')).toBeNull();
  });

  it('checks the password against the stored hash', async () => {
    const username = `user_${unique()}`;
    const user = await createUser(username, 'a-good-password');

    expect(user).not.toBeNull();
    expect(await checkPassword(user!, 'a-good-password')).toBe(true);
    expect(await checkPassword(user!, 'the-wrong-password')).toBe(false);
  });

  it('never stores the password itself', async () => {
    const username = `user_${unique()}`;
    const user = await createUser(username, 'a-good-password');

    expect(user?.passwordHash).not.toContain('a-good-password');
  });
});
