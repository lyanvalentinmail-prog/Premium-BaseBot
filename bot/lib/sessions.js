/**
 * Sesiones de juego en memoria con expiración automática.
 * (Estado efímero: no tiene sentido persistirlo entre reinicios.)
 */
const store = new Map();

const key = (namespace, id) => `${namespace}:${id}`;

export const setSession = (namespace, id, data, ttlMs = 5 * 60_000) => {
  store.set(key(namespace, id), { data, expires: Date.now() + ttlMs });
  return data;
};

export const getSession = (namespace, id) => {
  const entry = store.get(key(namespace, id));
  if (!entry) return null;
  if (entry.expires < Date.now()) {
    store.delete(key(namespace, id));
    return null;
  }
  return entry.data;
};

export const touchSession = (namespace, id, ttlMs = 5 * 60_000) => {
  const entry = store.get(key(namespace, id));
  if (entry) entry.expires = Date.now() + ttlMs;
};

export const deleteSession = (namespace, id) => store.delete(key(namespace, id));

export const countSessions = () => store.size;

const interval = setInterval(() => {
  const now = Date.now();
  for (const [k, entry] of store) if (entry.expires < now) store.delete(k);
}, 60_000);
interval.unref?.();

export default { setSession, getSession, deleteSession, touchSession, countSessions };
