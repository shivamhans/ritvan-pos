const configuredApiBase = (import.meta.env.VITE_API_URL || 'http://localhost:4001/api').replace(/\/$/, '');

function isPrivateIPv4(hostname) {
  const parts = String(hostname || '').split('.');
  if (parts.length !== 4 || parts.some(part => part.trim() === '' || !Number.isInteger(Number(part)) || Number(part) < 0 || Number(part) > 255)) return false;
  const [a, b] = parts.map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function resolveApiBaseUrl() {
  // A remote device's localhost is itself, not the PC running Ritvan.
  // When opened via a private IPv4 address, redirect a local API URL to that same host.
  if (typeof window !== 'undefined' && isPrivateIPv4(window.location.hostname)) {
    try {
      const configured = new URL(configuredApiBase);
      if (['localhost', '127.0.0.1', '::1'].includes(configured.hostname)) {
        configured.hostname = window.location.hostname;
        return configured.toString().replace(/\/$/, '');
      }
    } catch {
      // Keep the configured URL; apiRequest will surface a readable connection error.
    }
  }
  return configuredApiBase;
}

export const API_BASE_URL = resolveApiBaseUrl();
export async function apiRequest(path, options = {}) {
  const { token, body, headers = {}, ...rest } = options;
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`, {
      ...rest,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(new URL(API_BASE_URL).hostname.includes('ngrok') ? { 'ngrok-skip-browser-warning': 'true' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new Error(`Cannot reach the Ritvan API at ${API_BASE_URL}. Check that the API server is running and both devices are on the same Wi-Fi.`);
  }

  const text = await response.text();
  let payload = {};
  if (text) {
    try { payload = JSON.parse(text); }
    catch { payload = { error: 'The server returned an invalid response.' }; }
  }
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed with status ${response.status}.`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

const productColors = ['mint', 'amber', 'rose', 'lavender', 'blue'];
const productGlyphs = ['◉', '◌', '◈', '◐', '✳'];

export function toUiItems(rows = []) {
  return rows.map((row, index) => {
    const stock = Number(row.qty_on_hand ?? 0);
    return {
      id: String(row.id),
      apiId: Number(row.id),
      displayId: `NX-${String(row.id).padStart(4, '0')}`,
      name: row.name,
      category: row.category || 'Uncategorized',
      categoryId: row.category_id == null ? null : Number(row.category_id),
      barcode: row.barcode || '',
      sku: row.sku || '',
      price: Number(row.selling_price ?? 0),
      cost: Number(row.avg_cost ?? 0),
      stock,
      reorderThreshold: Number(row.reorder_threshold ?? 8),
      imageUrl: row.image_data || null,
      status: stock === 0 ? 'Out of stock' : stock <= Number(row.reorder_threshold ?? 8) ? 'Low stock' : 'In stock',
      color: productColors[index % productColors.length],
      icon: productGlyphs[index % productGlyphs.length],
    };
  });
}
