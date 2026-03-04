import AsyncStorage from "@react-native-async-storage/async-storage";

export const OFFLINE_QUEUE_KEY = "bbf_offline_scans";
export const HISTORY_KEY = "bbf_scan_history";

/**
 * History item shape:
 * {
 *   id: string,
 *   ts: number,
 *   time_label: string,
 *   direction: "IN"|"OUT",
 *   status: "SUCCESS"|"FAIL"|"OFFLINE_SAVED",
 *   qr_code: string,
 *   name?: string,
 *   company?: string,
 *   message?: string,
 * }
 */

export async function pushHistory(item) {
  const list = await getHistory();
  // De-dup: avoid rapid duplicate inserts (e.g., same QR held in frame)
  const top = list[0];
  if (
    top &&
    item &&
    top.qr_code === item.qr_code &&
    top.direction === item.direction &&
    top.status === item.status &&
    typeof top.ts === "number" &&
    typeof item.ts === "number" &&
    item.ts - top.ts < 1500
  ) {
    return;
  }
  list.unshift(item);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 2000)));
}

export async function getHistory() {
  const raw = await AsyncStorage.getItem(HISTORY_KEY);
  try {
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function clearHistory() {
  await AsyncStorage.removeItem(HISTORY_KEY);
}

export async function enqueueOfflineScan(payload) {
  const q = await getOfflineQueue();
  q.push(payload);
  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(q));
}

export async function getOfflineQueue() {
  const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
  try {
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function setOfflineQueue(queue) {
  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue || []));
}

export async function clearOfflineQueue() {
  await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
}
