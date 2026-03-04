import axios from "axios";
import Constants from "expo-constants";
import { getToken } from "../storage/token";

const rawBase = Constants.expoConfig?.extra?.API_BASE_URL || "";
const base = rawBase.replace(/\/$/, "");

export const api = axios.create({
  baseURL: `${base}/api`,
  timeout: 20000,
  headers: { Accept: "application/json" }
});

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
