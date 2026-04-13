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
 *   gate?: string,          // ⭐ Gate added
 *   name?: string,
 *   company?: string,
 *   message?: string,
 * }
 */

export async function pushHistory(item) {
  const list = await getHistory();

  const top = list[0];

  // Prevent duplicate scans within 1.5 seconds
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

  const safeItem = {
    id: item.id || String(Date.now()),
    ts: item.ts || Date.now(),
    time_label: item.time_label || "",
    direction: item.direction || "",
    status: item.status || "",
    qr_code: item.qr_code || "",
    gate: item.gate || "", // ⭐ stored gate
    name: item.name || "",
    company: item.company || "",
    message: item.message || "",
  };

  list.unshift(safeItem);

  // Keep max 2000 history records
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
  const queue = await getOfflineQueue();

  queue.push(payload);

  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
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
