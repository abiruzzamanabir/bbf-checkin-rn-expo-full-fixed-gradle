import { api } from "./client";

export async function fetchGates(event_slug) {
  const res = await api.get("/gates", { params: { event_slug } });
  return res.data?.gates || [];
}
