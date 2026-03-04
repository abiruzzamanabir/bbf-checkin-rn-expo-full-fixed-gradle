import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "bbf_settings_v1";

export const DEFAULT_SETTINGS = {
  event: null,       // { id, name, slug }
  gate: null,        // { id, name, code }
  direction: "IN",   // "IN" | "OUT"
};

export async function getSettings() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function setSettings(next) {
  const merged = { ...(await getSettings()), ...next };
  await AsyncStorage.setItem(KEY, JSON.stringify(merged));
  return merged;
}

export async function clearSettings() {
  await AsyncStorage.removeItem(KEY);
}
