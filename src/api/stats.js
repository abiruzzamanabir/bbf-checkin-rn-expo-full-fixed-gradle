import { api } from "./client";

/* ---------------- FETCH EVENT STATS ---------------- */

export async function fetchEventStats(event_slug) {
  try {
    /* ---------------- SAFE EMPTY ---------------- */

    if (!event_slug) {
      return {
        inside: 0,

        total_in: 0,

        total_out: 0,

        total_entries: 0,

        total_exits: 0,

        current_inside: 0,

        current_outside: 0,

        total_tickets: 0,

        gates: [],

        timeline: [],

        updated_at: null,
      };
    }

    /* ---------------- API ---------------- */

    const res = await api.get("/analytics/overview", {
      params: { event_slug },
    });

    const raw = res?.data?.data || res?.data || {};

    /* ---------------- NORMALIZATION ---------------- */

    const totalEntries = Number(
      raw.total_entries ?? raw.total_in ?? raw.entries ?? 0,
    );

    const totalExits = Number(
      raw.total_exits ?? raw.total_out ?? raw.exits ?? 0,
    );

    const currentInside = Number(
      raw.current_inside ??
        raw.currently_inside ??
        raw.inside_now ??
        raw.inside_count ??
        raw.inside ??
        Math.max(totalEntries - totalExits, 0),
    );

    const currentOutside = Number(
      raw.current_outside ?? raw.outside_count ?? 0,
    );

    /* ---------------- FINAL RESPONSE ---------------- */

    return {
      /* LEGACY SUPPORT */

      total_in: totalEntries,

      total_out: totalExits,

      inside: currentInside,

      /* NEW STANDARD */

      total_entries: totalEntries,

      total_exits: totalExits,

      current_inside: currentInside,

      current_outside: currentOutside,

      total_tickets: Number(raw.total_tickets || 0),

      /* OPTIONAL */

      gates: Array.isArray(raw.gate_breakdown)
        ? raw.gate_breakdown
        : Array.isArray(raw.gates)
          ? raw.gates
          : [],

      timeline: Array.isArray(raw.hourly)
        ? raw.hourly
        : Array.isArray(raw.timeline)
          ? raw.timeline
          : [],

      updated_at: raw.server_time || raw.updated_at || null,
    };
  } catch (error) {
    /* ---------------- DEBUG ---------------- */

    // console.log(
    //   "FETCH EVENT STATS ERROR:",
    //   error?.response?.data || error?.message,
    // );

    /* ---------------- SAFE FALLBACK ---------------- */

    return {
      inside: 0,

      total_in: 0,

      total_out: 0,

      total_entries: 0,

      total_exits: 0,

      current_inside: 0,

      current_outside: 0,

      total_tickets: 0,

      gates: [],

      timeline: [],

      updated_at: null,
    };
  }
}
