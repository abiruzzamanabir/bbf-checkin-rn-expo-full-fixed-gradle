import { api } from "./client";

/**
 * GET /api/stats/event?event_slug=...
 */
export async function fetchEventStats(event_slug) {
  const res = await api.get("/stats/event", { params: { event_slug } });
  return res.data;
}
