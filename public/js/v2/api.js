export async function api(path, { method = 'GET', body, ...options } = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options, method, headers: { 'Content-Type': 'application/json', ...options.headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || `Request failed (${response.status})`);
    error.status = response.status;
    error.fields = data.errors;
    throw error;
  }
  return data;
}
