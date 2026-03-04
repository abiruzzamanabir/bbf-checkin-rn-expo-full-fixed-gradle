import { api } from "./client";

/**
 * GET /api/tickets/search?event_slug=...&q=...&limit=...
 * Role: scanner
 */
export async function searchTickets({ event_slug, q, limit = 12 }) {
  const res = await api.get("/tickets/search", { params: { event_slug, q, limit } });
  return res.data;
}
