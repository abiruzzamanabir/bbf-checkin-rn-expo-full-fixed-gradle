import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "bbf_token";

/* ---------------- MEMORY CACHE ---------------- */

let cache = null;

/* ---------------- GET TOKEN ---------------- */

export async function getToken() {
  // ⚡ fast path
  if (cache) return cache;

  try {
    const token = await AsyncStorage.getItem(KEY);

    if (token && typeof token === "string" && token.length > 10) {
      cache = token;
      return token;
    }

    return null;
  } catch {
    return null;
  }
}

/* ---------------- SET TOKEN ---------------- */

export async function setToken(token) {
  if (!token || typeof token !== "string") return;

  cache = token;

  try {
    await AsyncStorage.setItem(KEY, token);
  } catch {
    cache = null;
  }
}

/* ---------------- CLEAR TOKEN ---------------- */

export async function clearToken() {
  cache = null;

  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // silent
  }
}
