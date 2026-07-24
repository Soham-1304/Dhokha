const configuredBaseUrl = import.meta.env.VITE_API_URL?.trim();
export const API_BASE_URL = (configuredBaseUrl || '/api').replace(/\/$/, '');
const configuredWebSocketUrl = import.meta.env.VITE_WS_URL?.trim();
export const WEBSOCKET_URL = configuredWebSocketUrl
  || 'wss://api.dhokha.bharathperni.dev/stream';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body?.detail;
    const message = typeof detail === 'string'
      ? detail
      : `Backend request failed with status ${response.status}`;
    throw new Error(message);
  }
  return body;
}

export function getHealth() {
  return request('/health');
}

export function loginUser(username, password) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function evaluateTransaction(payload) {
  return request('/v1/evaluate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function scoreTransaction(payload) {
  return request('/score', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function resetDemo() {
  return request('/demo/reset', { method: 'POST' });
}

export function injectSwarm(swarmType, size = 5) {
  return request('/demo/inject-swarm', {
    method: 'POST',
    body: JSON.stringify({ swarm_type: swarmType, size }),
  });
}

export function getAlerts(search = {}) {
  const params = new URLSearchParams(search);
  return request(`/alerts${params.size ? `?${params}` : ''}`);
}

export function getSubgraph(accountId, depth = 2) {
  return request(`/graph/subgraph/${encodeURIComponent(accountId)}?depth=${depth}`);
}

export function connectEventStream({
  onOpen,
  onEvent,
  onError,
  onClose,
} = {}) {
  const socket = new WebSocket(WEBSOCKET_URL);
  socket.addEventListener('open', () => onOpen?.());
  socket.addEventListener('message', event => {
    try {
      onEvent?.(JSON.parse(event.data));
    } catch {
      // Ignore malformed events without taking down the live dashboard.
    }
  });
  socket.addEventListener('error', event => onError?.(event));
  socket.addEventListener('close', event => onClose?.(event));
  return socket;
}

export function connectStream(onMessage, onError) {
  let socket;
  try {
    socket = new WebSocket(WEBSOCKET_URL);
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (onMessage) onMessage(data);
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };
    socket.onerror = (err) => {
      if (onError) onError(err);
    };
  } catch (err) {
    if (onError) onError(err);
  }

  return () => {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      socket.close();
    }
  };
}
