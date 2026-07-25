const STORAGE_KEY = 'dhokha.recent-live-payments';
const CHANNEL_NAME = 'dhokha-live-payments';
const MAX_RECENT_PAYMENTS = 20;

function readStoredPayments() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getRecentLivePayments() {
  if (typeof window === 'undefined') return [];
  return readStoredPayments();
}

export function publishLivePayment(payment) {
  if (typeof window === 'undefined') return;

  const recent = [
    payment,
    ...readStoredPayments().filter(item => item.id !== payment.id),
  ].slice(0, MAX_RECENT_PAYMENTS);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(recent));

  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage(payment);
    channel.close();
  }
}

export function subscribeToLivePayments(onPayment) {
  if (typeof window === 'undefined') return () => {};

  const handleStorage = event => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      const [latest] = JSON.parse(event.newValue);
      if (latest) onPayment(latest);
    } catch {
      // Ignore malformed browser storage entries.
    }
  };
  window.addEventListener('storage', handleStorage);

  let channel;
  if ('BroadcastChannel' in window) {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.addEventListener('message', event => onPayment(event.data));
  }

  return () => {
    window.removeEventListener('storage', handleStorage);
    channel?.close();
  };
}
