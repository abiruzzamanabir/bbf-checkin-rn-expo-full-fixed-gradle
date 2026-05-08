import { api } from "./client";

/* ---------------- SEARCH TICKETS ---------------- */

export async function searchTickets({ event_slug, q, limit = 12 }) {
  // 🔒 avoid useless API calls

  if (!q || q.trim().length < 2) {
    return {
      items: [],
      total: 0,
    };
  }

  try {
    const res = await api.get("/tickets/search", {
      params: {
        event_slug,
        q,
        limit,
      },
    });

    const data = res?.data || {};

    const items = Array.isArray(data.items) ? data.items : [];

    // ✅ proper normalization

    const cleaned = items.map((t) => ({
      ticket_id: t.ticket_id,

      qr_code: t.qr_code,

      is_inside: t.is_inside,

      total_inside_time: t.total_inside_time,

      attendee: {
        full_name: t.attendee?.full_name || "Unknown Attendee",

        company: t.attendee?.company || "",
      },
    }));

    // console.log("SEARCH CLEANED =", JSON.stringify(cleaned, null, 2));

    return {
      items: cleaned,
      total: Number(data.total || cleaned.length),
    };
  } catch (error) {
    /* -------- NETWORK / OFFLINE -------- */

    if (!error.response) {
      // console.log("Search offline");
    } else {
      // console.log("Search API error:", error.response.status);
    }

    return {
      items: [],
      total: 0,
    };
  }
}
