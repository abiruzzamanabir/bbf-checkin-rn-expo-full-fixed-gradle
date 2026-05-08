import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "bbf_settings_v2"; // ✅ version bump

export const DEFAULT_SETTINGS = {
  event: null, // { id, name, slug }
  gate: null, // { id, name, code }
  direction: "IN", // "IN" | "OUT"
};

/* ---------------- VALIDATION ---------------- */

function sanitize(settings) {
  return {
    event: settings?.event && settings.event.slug ? settings.event : null,

    gate: settings?.gate && settings.gate.id ? settings.gate : null,

    direction: settings?.direction === "OUT" ? "OUT" : "IN",
  };
}

/* ---------------- GET ---------------- */

export async function getSettings() {
  try {
    const raw = await AsyncStorage.getItem(KEY);

    if (!raw) return DEFAULT_SETTINGS;

    const parsed = JSON.parse(raw);

    return sanitize({
      ...DEFAULT_SETTINGS,
      ...parsed,
    });
  } catch {
    // 🔥 auto-reset if corrupted
    await AsyncStorage.removeItem(KEY);
    return DEFAULT_SETTINGS;
  }
}

/* ---------------- SET ---------------- */

export async function setSettings(next) {
  try {
    const current = await getSettings();

    const merged = sanitize({
      ...current,
      ...next,
    });

    await AsyncStorage.setItem(KEY, JSON.stringify(merged));

    return merged;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/* ---------------- CLEAR ---------------- */

export async function clearSettings() {
  await AsyncStorage.removeItem(KEY);
}
