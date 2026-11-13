// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { clientIp } from './client-ip';

function req(headers: Record<string, string>): Request {
  return new Request('http://localhost/api/auth/login', { headers });
}

describe('the address of a request', () => {
  it('takes the address the edge wrote down', () => {
    expect(clientIp(req({ 'x-forwarded-for': '203.0.113.7' }))).toBe('203.0.113.7');
  });

  it('believes the last entry of the chain, not the first', () => {
    // The first entry is written by whoever asked, the last one by the proxy
    // closest to the app.
    expect(clientIp(req({ 'x-forwarded-for': '198.51.100.4, 203.0.113.7' }))).toBe('203.0.113.7');
  });

  it('falls back to the other name for the same address', () => {
    expect(clientIp(req({ 'x-real-ip': '203.0.113.9' }))).toBe('203.0.113.9');
  });

  it('refuses anything that is not an address', () => {
    expect(clientIp(req({ 'x-forwarded-for': 'not-an-address' }))).toBe('unknown');
    expect(clientIp(req({ 'x-forwarded-for': 'a'.repeat(200) }))).toBe('unknown');
    expect(clientIp(req({ 'x-forwarded-for': 'deadbeef01' }))).toBe('unknown');
    expect(clientIp(req({ 'x-forwarded-for': '999.999.999.999' }))).toBe('unknown');
  });

  it('takes ipv6 addresses', () => {
    expect(clientIp(req({ 'x-forwarded-for': '2001:db8::1' }))).toBe('2001:db8::1');
    expect(clientIp(req({ 'x-forwarded-for': '::1' }))).toBe('::1');
    expect(
      clientIp(req({ 'x-forwarded-for': '2001:0db8:85a3:0000:0000:8a2e:0370:7334' })),
    ).toBe('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
  });

  it('refuses a malformed ipv6 address', () => {
    expect(clientIp(req({ 'x-forwarded-for': '2001:db8:::1' }))).toBe('unknown');
    expect(clientIp(req({ 'x-forwarded-for': 'zzzz::1' }))).toBe('unknown');
  });

  it('has one answer when nothing says', () => {
    expect(clientIp(req({}))).toBe('unknown');
  });
});
