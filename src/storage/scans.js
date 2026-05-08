import AsyncStorage from "@react-native-async-storage/async-storage";

export const OFFLINE_QUEUE_KEY = "bbf_offline_scans";
export const HISTORY_KEY = "bbf_scan_history";

/* ---------------- SAFE JSON ---------------- */

async function readJSON(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeJSON(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // silent fail
  }
}

/* ---------------- HISTORY ---------------- */

export async function pushHistory(item) {
  const list = await readJSON(HISTORY_KEY);
  const top = list[0];

  // 🔐 Prevent rapid duplicates (1.5s)
  if (
    top &&
    item &&
    top.qr_code === item.qr_code &&
    top.direction === item.direction &&
    top.status === item.status &&
    item.ts - top.ts < 1500
  ) {
    return;
  }

  const safeItem = {
    id: item.id || String(Date.now()),
    ts: item.ts || Date.now(),
    time_label: item.time_label || "",
    direction: item.direction || "",
    status: item.status || "",
    qr_code: item.qr_code || "",
    gate: item.gate || "",
    name: item.name || "",
    company: item.company || "",
    message: item.message || "",
  };

  list.unshift(safeItem);

  // 🔒 Limit size (avoid memory blow)
  await writeJSON(HISTORY_KEY, list.slice(0, 2000));
}

export async function getHistory() {
  return await readJSON(HISTORY_KEY);
}

export async function clearHistory() {
  await AsyncStorage.removeItem(HISTORY_KEY);
}

/* ---------------- OFFLINE QUEUE ---------------- */

export async function enqueueOfflineScan(payload) {
  const queue = await readJSON(OFFLINE_QUEUE_KEY);

  // 🔐 Prevent duplicate queue entry
  const exists = queue.find(
    (q) =>
      q.qr_code === payload.qr_code &&
      q.direction === payload.direction &&
      Math.abs(q.ts - payload.ts) < 2000,
  );

  if (exists) return;

  queue.push({
    ...payload,
    ts: payload.ts || Date.now(),
    retry: 0, // 🔁 retry count
  });

  // 🔒 Limit queue size
  const trimmed = queue.slice(-500);

  await writeJSON(OFFLINE_QUEUE_KEY, trimmed);
}

export async function getOfflineQueue() {
  return await readJSON(OFFLINE_QUEUE_KEY);
}

export async function setOfflineQueue(queue) {
  await writeJSON(OFFLINE_QUEUE_KEY, queue || []);
}

export async function clearOfflineQueue() {
  await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
}
