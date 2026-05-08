// src/api/analytics.js

import { api } from "./client";

/* ---------------- HELPERS ---------------- */

const number = (v) => Number(v || 0);

const safeArray = (v) => (Array.isArray(v) ? v : []);

const safeObject = (v) =>
  v && typeof v === "object" && !Array.isArray(v) ? v : {};

/* ---------------- DEFAULT ML ---------------- */

const DEFAULT_ML_SCORING = {
  avg_engagement_score: 0,

  avg_anomaly_score: 0,

  high_engagement: 0,

  medium_engagement: 0,

  low_engagement: 0,

  high_risk: 0,

  medium_risk: 0,

  low_risk: 0,

  flagged_users: [],

  likely_to_leave: [],
};

/* ---------------- DEFAULT ANOMALY ---------------- */

const DEFAULT_ANOMALIES = {
  total_anomalies: 0,

  failed_qr_patterns: [],

  gate_pressure: [],

  hourly_spikes: [],

  flagged_users: [],
};

/* ---------------- DEFAULT PAYLOAD ---------------- */

export const DEFAULT_ANALYTICS = {
  hourly: [],

  gate_breakdown: [],

  congested_gates: [],

  inside_users: [],

  top_users: [],

  total_entries: 0,

  total_exits: 0,

  inside_now: 0,

  currently_inside: 0,

  avg_dwell_time: 0,

  repeat_visitors: 0,

  peak_hour: null,

  ml_scoring: DEFAULT_ML_SCORING,

  anomalies: DEFAULT_ANOMALIES,
};

/* ---------------- NORMALIZER ---------------- */

export function normalizeAnalyticsPayload(payload) {
  const raw = safeObject(payload);

  const ml = safeObject(raw.ml_scoring);

  const anomaly = safeObject(raw.anomalies);

  /* -------------------------------- */
  /* NORMALIZED COUNTERS */
  /* -------------------------------- */

  const totalEntries = number(
    raw.total_entries ?? raw.total_in ?? raw.entries ?? 0,
  );

  const totalExits = number(raw.total_exits ?? raw.total_out ?? raw.exits ?? 0);

  const insideNow = number(
    raw.inside_now ??
      raw.currently_inside ??
      raw.current_inside ??
      raw.inside_count ??
      raw.inside ??
      Math.max(totalEntries - totalExits, 0),
  );

  return {
    ...DEFAULT_ANALYTICS,

    ...raw,

    /* -------------------------------- */
    /* ARRAYS */
    /* -------------------------------- */

    hourly: safeArray(raw.hourly ?? raw.timeline ?? []),

    gate_breakdown: safeArray(raw.gate_breakdown ?? raw.gates ?? []),

    congested_gates: safeArray(raw.congested_gates),

    inside_users: safeArray(raw.inside_users),

    top_users: safeArray(raw.top_users),

    /* -------------------------------- */
    /* MAIN COUNTERS */
    /* -------------------------------- */

    total_entries: totalEntries,

    total_exits: totalExits,

    inside_now: insideNow,

    currently_inside: insideNow,

    /* -------------------------------- */
    /* EXTRA */
    /* -------------------------------- */

    avg_dwell_time: number(raw.avg_dwell_time),

    repeat_visitors: number(raw.repeat_visitors),

    peak_hour: raw.peak_hour || null,

    /* -------------------------------- */
    /* ML */
    /* -------------------------------- */

    ml_scoring: {
      ...DEFAULT_ML_SCORING,

      ...ml,

      avg_engagement_score: number(ml.avg_engagement_score),

      avg_anomaly_score: number(ml.avg_anomaly_score),

      high_engagement: number(ml.high_engagement),

      medium_engagement: number(ml.medium_engagement),

      low_engagement: number(ml.low_engagement),

      high_risk: number(ml.high_risk),

      medium_risk: number(ml.medium_risk),

      low_risk: number(ml.low_risk),

      flagged_users: safeArray(ml.flagged_users),

      likely_to_leave: safeArray(ml.likely_to_leave),
    },

    /* -------------------------------- */
    /* ANOMALIES */
    /* -------------------------------- */

    anomalies: {
      ...DEFAULT_ANOMALIES,

      ...anomaly,

      total_anomalies: number(anomaly.total_anomalies),

      failed_qr_patterns: safeArray(anomaly.failed_qr_patterns),

      gate_pressure: safeArray(anomaly.gate_pressure),

      hourly_spikes: safeArray(anomaly.hourly_spikes),

      flagged_users: safeArray(anomaly.flagged_users),
    },
  };
}

/* ---------------- OVERVIEW ---------------- */

export async function getAnalyticsOverview(event_slug) {
  try {
    if (!event_slug) {
      return DEFAULT_ANALYTICS;
    }

    const res = await api.get("/analytics/overview", {
      params: {
        event_slug,
      },
    });

    const payload = res?.data?.data || res?.data || {};

    return normalizeAnalyticsPayload(payload);
  } catch (e) {
    // console.log("ANALYTICS ERROR:", e?.response?.data || e);

    return DEFAULT_ANALYTICS;
  }
}

/* ---------------- USER JOURNEY ---------------- */

export async function getUserJourney({ event_slug, user_id }) {
  try {
    const res = await api.get("/analytics/user-journey", {
      params: {
        event_slug,
        user_id,
      },
    });

    return safeArray(res?.data?.data || res?.data);
  } catch (e) {
    // console.log("USER JOURNEY ERROR:", e?.response?.data || e);

    return [];
  }
}

/* ---------------- QR USER ---------------- */

export async function getQrUser(qr_code) {
  try {
    const res = await api.get("/analytics/qr-user", {
      params: {
        qr_code,
      },
    });

    return res?.data?.data || res?.data || null;
  } catch (e) {
    // console.log("QR USER ERROR:", e?.response?.data || e);

    return null;
  }
}
