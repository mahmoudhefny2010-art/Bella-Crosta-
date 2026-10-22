function classifyGoogleError(error) {
  const nested = error.oauthError || error.cause || {};
  const networkCode = nested.code || nested.cause?.code || error.code;
  if (['EACCES', 'EPERM', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'ENETUNREACH', 'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'SELF_SIGNED_CERT_IN_CHAIN'].includes(networkCode)) {
    return { reason: 'google_network', detail: networkCode };
  }
  let providerCode = error.code;
  try { providerCode = JSON.parse(nested.data).error || providerCode; } catch {}
  if (providerCode === 'invalid_client') return { reason: 'google_credentials', detail: 'invalid_client' };
  if (providerCode === 'invalid_grant') return { reason: 'google_retry', detail: 'invalid_grant' };
  return { reason: 'google', detail: error.name === 'InternalOAuthError' ? 'provider_request_failed' : 'sign_in_failed' };
}
module.exports = { classifyGoogleError };
