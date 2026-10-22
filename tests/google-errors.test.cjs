const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyGoogleError } = require('../server/auth/errors');
test('Google failures classify network, credentials and expired codes without exposing provider data', () => {
  assert.deepEqual(classifyGoogleError({ oauthError: { code: 'EACCES', data: 'private request' } }), { reason: 'google_network', detail: 'EACCES' });
  assert.equal(classifyGoogleError({ oauthError: { data: JSON.stringify({ error: 'invalid_client', error_description: 'private details' }) } }).reason, 'google_credentials');
  assert.equal(classifyGoogleError({ code: 'invalid_grant' }).reason, 'google_retry');
  assert.deepEqual(classifyGoogleError({ name: 'InternalOAuthError', oauthError: { data: 'secret tokens' } }), { reason: 'google', detail: 'provider_request_failed' });
});
