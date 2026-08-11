const test = require('node:test');
const assert = require('node:assert/strict');

const { getRateLimitKey } = require('../utils/rateLimitKey');

const makeReq = (overrides = {}) => ({
  headers: {},
  socket: {},
  ...overrides,
});

test('prefers configured trusted header', () => {
  process.env.RATE_LIMIT_TRUSTED_IP_HEADER = 'x-my-cdn-ip';
  const req = makeReq({
    headers: { 'x-my-cdn-ip': '203.0.113.5' },
    socket: { remoteAddress: '10.0.0.1' },
  });

  assert.equal(getRateLimitKey(req), '203.0.113.5');
  delete process.env.RATE_LIMIT_TRUSTED_IP_HEADER;
});

test('falls back to CF-Connecting-IP', () => {
  const req = makeReq({
    headers: { 'cf-connecting-ip': '198.51.100.7' },
    socket: { remoteAddress: '10.0.0.1' },
  });

  assert.equal(getRateLimitKey(req), '198.51.100.7');
});

test('falls back to X-Real-IP', () => {
  const req = makeReq({
    headers: { 'x-real-ip': '192.0.2.42' },
    socket: { remoteAddress: '10.0.0.1' },
  });

  assert.equal(getRateLimitKey(req), '192.0.2.42');
});

test('falls back to socket remote address when no trusted headers', () => {
  const req = makeReq({
    headers: {},
    socket: { remoteAddress: '10.0.0.1' },
  });

  assert.equal(getRateLimitKey(req), '10.0.0.1');
});

test('ignores spoofable X-Forwarded-For', () => {
  const req = makeReq({
    headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    socket: { remoteAddress: '10.0.0.1' },
  });

  assert.equal(getRateLimitKey(req), '10.0.0.1');
});

test('strips IPv4-mapped IPv6 and ports', () => {
  const req = makeReq({
    headers: { 'x-real-ip': '::ffff:192.0.2.1' },
  });

  assert.equal(getRateLimitKey(req), '192.0.2.1');
});

test('collapses IPv6 addresses into a /56 subnet key', () => {
  const req = makeReq({
    headers: { 'cf-connecting-ip': '2001:0db8:1234:5678:9abc:def0:1234:5678' },
  });

  assert.equal(getRateLimitKey(req), '2001:db8:1234:5600::/56');
});

test('returns unknown for missing data', () => {
  const req = makeReq();

  assert.equal(getRateLimitKey(req), 'unknown');
});
