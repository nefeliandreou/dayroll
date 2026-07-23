async function request(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  me: () => request('/api/auth/me'),
  register: (email, password) =>
    request('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
  login: (email, password) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request('/api/auth/logout', { method: 'POST', body: '{}' }),

  lists: () => request('/api/lists'),
  todos: (ownerId, today) =>
    request(`/api/lists/${ownerId}/todos?today=${encodeURIComponent(today)}`),
  createTodo: (ownerId, text, day) =>
    request(`/api/lists/${ownerId}/todos`, {
      method: 'POST',
      body: JSON.stringify({ text, day }),
    }),
  updateTodo: (ownerId, todoId, patch) =>
    request(`/api/lists/${ownerId}/todos/${todoId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deleteTodo: (ownerId, todoId) =>
    request(`/api/lists/${ownerId}/todos/${todoId}`, { method: 'DELETE' }),

  shares: () => request('/api/lists/me/shares'),
  addShare: (email) =>
    request('/api/lists/me/shares', { method: 'POST', body: JSON.stringify({ email }) }),
  removeShare: (email) =>
    request(`/api/lists/me/shares/${encodeURIComponent(email)}`, { method: 'DELETE' }),
};
