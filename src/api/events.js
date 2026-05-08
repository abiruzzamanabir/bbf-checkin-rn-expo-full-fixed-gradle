import { api } from "./client";

/* ---------------- FETCH EVENTS ---------------- */

export async function fetchEvents() {
  try {
    const res = await api.get("/events");

    const events = res?.data?.events;

    if (!Array.isArray(events)) {
      return [];
    }

    // ✅ Normalize (optional but useful)
    return events.map((e) => ({
      id: e.id,
      name: e.name,
      slug: e.slug,
      is_active: !!e.is_active,
      start_date: e.start_date || null,
      end_date: e.end_date || null,
    }));
  } catch (error) {
    /* -------- NETWORK / OFFLINE -------- */
    if (!error.response) {
      // console.log("Offline → returning empty events");
    } else {
      /* -------- API ERROR -------- */
      // console.log("Events API error:", error.response.status);
    }

    return [];
  }
}
