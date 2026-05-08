import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./client";

const TOKEN_KEY = "bbf_token";
const ROLE_KEY = "bbf_role";
const USER_KEY = "bbf_user";

/* ---------------- LOGIN ---------------- */

export async function login({ email, password, device_name }) {
  const res = await api.post("/auth/login", {
    email,
    password,
    device_name,
  });

  const { token, user } = res.data;

  /* ---------------- SAVE TOKEN ---------------- */

  await AsyncStorage.setItem(TOKEN_KEY, token);

  /* ---------------- SAVE ROLE ---------------- */

  const role = String(user?.role || "scanner").toUpperCase();

  await AsyncStorage.setItem(ROLE_KEY, role);

  /* ---------------- SAVE USER ---------------- */

  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user || {}));

  console.log("ROLE SAVED:", role);

  return {
    token,
    user,
  };
}

/* ---------------- GET USER ---------------- */

export async function me() {
  const res = await api.get("/auth/me");

  console.log("ME RESPONSE:", res.data);

  const user = res?.data?.user || {};

  /* ---------------- UPDATE ROLE ---------------- */

  const role = String(user?.role || "scanner").toUpperCase();

  await AsyncStorage.setItem(ROLE_KEY, role);

  /* ---------------- UPDATE USER ---------------- */

  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));

  console.log("UPDATED ROLE:", role);

  return res.data;
}

/* ---------------- LOGOUT ---------------- */

export async function logout() {
  try {
    await api.post("/auth/logout");
  } catch (e) {
    // ignore offline failure
  }

  /* ---------------- CLEAR STORAGE ---------------- */

  await AsyncStorage.multiRemove([TOKEN_KEY, ROLE_KEY, USER_KEY]);
}

/* ---------------- HELPERS ---------------- */

export async function getStoredRole() {
  const role = await AsyncStorage.getItem(ROLE_KEY);

  return String(role || "SCANNER").toUpperCase();
}

export async function getStoredUser() {
  const raw = await AsyncStorage.getItem(USER_KEY);

  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
