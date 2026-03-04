import { api } from "./client";

export async function login({ email, password, device_name }) {
  const res = await api.post("/auth/login", { email, password, device_name });
  return res.data; // { token, user }
}

export async function me() {
  const res = await api.get("/auth/me");
  return res.data;
}

export async function logout() {
  const res = await api.post("/auth/logout");
  return res.data;
}
