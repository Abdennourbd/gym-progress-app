import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LoginScreen } from './LoginScreen';

interface Reply {
  status: number;
  body: unknown;
}

function mockFetch(handler: (url: string, body: unknown) => Reply) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    const reply = handler(url, body);
    return {
      ok: reply.status >= 200 && reply.status < 300,
      status: reply.status,
      json: async () => reply.body,
    } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the login screen', () => {
  it('offers a way to create an account', async () => {
    mockFetch(() => ({ status: 200, body: { inviteRequired: false } }));
    render(<LoginScreen onSignedIn={vi.fn()} />);

    expect(screen.getByRole('tab', { name: 'Create an account' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('asks for a username and a password to sign in', async () => {
    mockFetch(() => ({ status: 200, body: { inviteRequired: false } }));
    render(<LoginScreen onSignedIn={vi.fn()} />);

    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.queryByLabelText('Confirm password')).not.toBeInTheDocument();
  });

  it('asks for the password twice when making an account', async () => {
    mockFetch(() => ({ status: 200, body: { inviteRequired: false } }));
    render(<LoginScreen onSignedIn={vi.fn()} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Create an account' }));

    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();
  });

  it('signs in and hands the account over', async () => {
    mockFetch((url) =>
      url.includes('/login')
        ? { status: 200, body: { ok: true, user: { id: 'u-1', username: 'amina' } } }
        : { status: 200, body: { inviteRequired: false } },
    );
    const onSignedIn = vi.fn();
    render(<LoginScreen onSignedIn={onSignedIn} />);

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'amina' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'a-good-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith({ id: 'u-1', username: 'amina' }));
  });

  it('makes an account and signs it straight in', async () => {
    mockFetch((url) =>
      url.includes('/signup')
        ? { status: 200, body: { ok: true, user: { id: 'u-2', username: 'newbie' } } }
        : { status: 200, body: { inviteRequired: false } },
    );
    const onSignedIn = vi.fn();
    render(<LoginScreen onSignedIn={onSignedIn} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Create an account' }));
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'newbie' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'a-good-password' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'a-good-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create an account' }));

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith({ id: 'u-2', username: 'newbie' }));
  });

  it('says when the username is taken', async () => {
    mockFetch((url) =>
      url.includes('/signup')
        ? { status: 409, body: { error: 'username_taken' } }
        : { status: 200, body: { inviteRequired: false } },
    );
    render(<LoginScreen onSignedIn={vi.fn()} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Create an account' }));
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'taken' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'a-good-password' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'a-good-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create an account' }));

    await waitFor(() => expect(screen.getByText('That username is taken.')).toBeInTheDocument());
  });

  it('does not say what was wrong about a sign in', async () => {
    mockFetch((url) =>
      url.includes('/login')
        ? { status: 401, body: { error: 'invalid_credentials' } }
        : { status: 200, body: { inviteRequired: false } },
    );
    render(<LoginScreen onSignedIn={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'amina' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(screen.getByText('Wrong username or password.')).toBeInTheDocument());
  });

  it('asks for an invite code only when the server wants one', async () => {
    mockFetch((url) =>
      url.includes('/config')
        ? { status: 200, body: { inviteRequired: true } }
        : { status: 200, body: { inviteRequired: true } },
    );
    render(<LoginScreen onSignedIn={vi.fn()} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Create an account' }));

    await waitFor(() => expect(screen.getByLabelText('Invite code')).toBeInTheDocument());
  });

  it('hides the invite code when the server does not want one', async () => {
    mockFetch(() => ({ status: 200, body: { inviteRequired: false } }));
    render(<LoginScreen onSignedIn={vi.fn()} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Create an account' }));

    await waitFor(() => expect(screen.queryByLabelText('Invite code')).not.toBeInTheDocument());
  });
});
