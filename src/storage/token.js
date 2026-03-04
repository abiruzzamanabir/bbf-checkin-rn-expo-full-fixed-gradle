import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "bbf_token";

export async function getToken() {
  return AsyncStorage.getItem(KEY);
}

export async function setToken(token) {
  return AsyncStorage.setItem(KEY, token);
}

export async function clearToken() {
  return AsyncStorage.removeItem(KEY);
}
