import { api } from "./client";

export async function fetchEvents() {
  const res = await api.get("/events");
  return res.data?.events || [];
}
