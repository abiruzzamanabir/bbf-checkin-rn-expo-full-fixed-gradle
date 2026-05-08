import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Modal,
  Pressable,
  FlatList,
  TextInput,
  Dimensions,
} from "react-native";

import { ActivityIndicator, Chip } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { LineChart, BarChart, PieChart } from "react-native-chart-kit";
import { useFocusEffect } from "@react-navigation/native";

import { getSettings } from "../storage/settings";
import { api } from "../api/client";

const { width } = Dimensions.get("window");

const REFRESH_MS = 5000;
const PREDICTION_GROWTH_RATIO = 1.3;
const BUSY_RATIO = 0.65;
const CONGESTED_RATIO = 0.85;

const number = (v) => {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
};

const safeArray = (v) => (Array.isArray(v) ? v : []);

const safeObject = (v) =>
  v && typeof v === "object" && !Array.isArray(v) ? v : {};

const text = (v, fallback = "N/A") => {
  if (v === null || v === undefined || v === "") return fallback;
  return String(v);
};

const formatNumber = (v) => number(v).toLocaleString("en-BD");

const formatMinutes = (v) => {
  const total = number(v);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h ${m}m`;
};
const format12Hour = (value) => {
  if (!value) return "N/A";

  try {
    const d = new Date(value);

    if (isNaN(d.getTime())) {
      return String(value);
    }

    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return String(value);
  }
};
const formatHourLabel = (value) => {
  if (!value) return "";

  try {
    if (String(value).includes(":")) {
      const [h] = String(value).split(":");

      let hour = Number(h);

      const suffix = hour >= 12 ? "PM" : "AM";

      hour = hour % 12 || 12;

      return `${hour}${suffix}`;
    }

    return value;
  } catch {
    return String(value);
  }
};
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

const DEFAULT_ANOMALIES = {
  total_anomalies: 0,
  failed_qr_patterns: [],
  gate_pressure: [],
  hourly_spikes: [],
  flagged_users: [],
};

const DEFAULT_ANALYTICS = {
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

function normalizeAnalyticsPayload(payload) {
  const raw = safeObject(payload);
  const ml = safeObject(raw.ml_scoring);
  const anomaly = safeObject(raw.anomalies);

  return {
    ...DEFAULT_ANALYTICS,
    ...raw,

    hourly: safeArray(raw.hourly),
    gate_breakdown: safeArray(raw.gate_breakdown),
    congested_gates: safeArray(raw.congested_gates),
    inside_users: safeArray(raw.inside_users),
    top_users: safeArray(raw.top_users),

    total_entries: number(raw.total_entries),
    total_exits: number(raw.total_exits),
    inside_now: number(raw.inside_now),
    currently_inside: number(raw.currently_inside),
    avg_dwell_time: number(raw.avg_dwell_time),
    repeat_visitors: number(raw.repeat_visitors),

    ml_scoring: {
      ...DEFAULT_ML_SCORING,
      ...ml,
      flagged_users: safeArray(ml.flagged_users),
      likely_to_leave: safeArray(ml.likely_to_leave),
    },

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

function getGateLabel(gate) {
  return (
    gate?.gate?.name ||
    gate?.gate ||
    gate?.label ||
    gate?.name ||
    gate?.code ||
    "Unknown Gate"
  );
}

function getGateCode(gate) {
  return gate?.code || gate?.gate?.code || gate?.gate || gate?.name || "N/A";
}

function getGateStatus(entries, maxEntries) {
  if (!maxEntries) return { label: "Normal", tone: "green", score: 0 };

  const ratio = entries / maxEntries;

  if (ratio >= CONGESTED_RATIO) {
    return { label: "Congested", tone: "red", score: 3 };
  }

  if (ratio >= BUSY_RATIO) {
    return { label: "Busy", tone: "amber", score: 2 };
  }

  return { label: "Normal", tone: "green", score: 1 };
}

function toneColor(tone) {
  if (tone === "red") return "#EF4444";
  if (tone === "amber") return "#F59E0B";
  if (tone === "violet") return "#A855F7";
  if (tone === "blue") return "#3B82F6";
  if (tone === "cyan") return "#06B6D4";
  return "#22C55E";
}

export default function AnalyticsScreen() {
  const [data, setData] = useState(null);
  const [eventSlug, setEventSlug] = useState(null);
  const [eventName, setEventName] = useState("Live Event");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const [detailModal, setDetailModal] = useState({
    open: false,
    title: "",
    data: [],
    type: "default",
  });

  const [selectedUser, setSelectedUser] = useState(null);
  const [userJourney, setUserJourney] = useState([]);
  const [loadingJourney, setLoadingJourney] = useState(false);

  const mountedRef = useRef(true);
  const loadingRef = useRef(false);

  const loadSettings = useCallback(async () => {
    const settings = await getSettings();
    const slug = settings?.event?.slug || null;

    setEventSlug(slug);
    setEventName(settings?.event?.name || "Live Event");

    return slug;
  }, []);

  const computePrediction = useCallback((hourly = []) => {
    if (!Array.isArray(hourly) || hourly.length < 3) return false;

    const last3 = hourly.slice(-3).map((item) => ({
      entries: number(item.entries),
      exits: number(item.exits),
    }));

    const strictIncrease =
      last3[2].entries > last3[1].entries &&
      last3[1].entries > last3[0].entries;

    const sharpGrowth =
      last3[0].entries > 0 &&
      last3[2].entries >= last3[0].entries * PREDICTION_GROWTH_RATIO;

    const entryExitGapGrowing =
      last3[2].entries - last3[2].exits > last3[1].entries - last3[1].exits &&
      last3[1].entries - last3[1].exits > last3[0].entries - last3[0].exits;

    return strictIncrease || sharpGrowth || entryExitGapGrowing;
  }, []);

  const load = useCallback(
    async (silent = false) => {
      if (loadingRef.current) return;

      try {
        loadingRef.current = true;

        if (!silent) setLoading(true);

        const slug = eventSlug || (await loadSettings());

        if (!slug) {
          setData(normalizeAnalyticsPayload(DEFAULT_ANALYTICS));

          setError("Select an event first.");

          return;
        }

        /* -------------------------------- */
        /* API REQUEST */
        /* -------------------------------- */

        const response = await api.get("/analytics/overview", {
          params: {
            event_slug: slug,
          },
        });

        /* -------------------------------- */
        /* DEBUG */
        /* -------------------------------- */

        // console.log(
        //   "ANALYTICS RAW RESPONSE:",
        //   JSON.stringify(response?.data, null, 2),
        // );

        if (!mountedRef.current) return;

        /* -------------------------------- */
        /* SUPPORT BOTH API STRUCTURES */
        /* -------------------------------- */

        const raw = response?.data?.data || response?.data || {};

        /* -------------------------------- */
        /* FIELD NAME NORMALIZATION */
        /* -------------------------------- */

        const normalized = {
          ...raw,

          /* ---- MAIN COUNTERS ---- */

          inside_now:
            raw.inside_now ??
            raw.currently_inside ??
            raw.inside_count ??
            raw.current_inside ??
            0,

          currently_inside:
            raw.currently_inside ??
            raw.inside_now ??
            raw.inside_count ??
            raw.current_inside ??
            0,

          total_entries: raw.total_entries ?? raw.total_in ?? raw.entries ?? 0,

          total_exits: raw.total_exits ?? raw.total_out ?? raw.exits ?? 0,

          /* ---- ARRAYS ---- */

          hourly: raw.hourly || raw.timeline || [],

          gate_breakdown: raw.gate_breakdown || raw.gates || [],

          top_users: raw.top_users || [],

          inside_users: raw.inside_users || [],

          congested_gates: raw.congested_gates || [],

          /* ---- AI ---- */

          ml_scoring: raw.ml_scoring || DEFAULT_ML_SCORING,

          anomalies: raw.anomalies || DEFAULT_ANOMALIES,
        };

        // console.log(
        //   "NORMALIZED ANALYTICS:",
        //   JSON.stringify(normalized, null, 2),
        // );

        const next = normalizeAnalyticsPayload(normalized);

        setData(next);

        setError(null);

        setLastUpdated(new Date());
      } catch (e) {
        // console.log("ANALYTICS LOAD ERROR:", e);

        if (!mountedRef.current) return;

        setError(
          e?.response?.data?.message ||
            e?.message ||
            "Failed to load analytics.",
        );
      } finally {
        loadingRef.current = false;

        if (mountedRef.current) {
          setLoading(false);

          setRefreshing(false);
        }
      }
    },
    [eventSlug, loadSettings],
  );

  useEffect(() => {
    mountedRef.current = true;

    load(false);

    if (!autoRefresh) {
      return () => {
        mountedRef.current = false;
      };
    }

    const timer = setInterval(() => {
      if (!detailModal.open && !selectedUser) load(true);
    }, REFRESH_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, [autoRefresh, detailModal.open, load, selectedUser]);

  useFocusEffect(
    React.useCallback(() => {
      load(true);
      return () => {};
    }, [load]),
  );

  const openDetail = useCallback((title, value, type = "default") => {
    let parsed = [];

    if (Array.isArray(value)) parsed = value;
    else if (value?.data && Array.isArray(value.data)) parsed = value.data;
    else if (value) parsed = [value];

    setDetailModal({
      open: true,
      title,
      data: parsed,
      type,
    });
  }, []);

  const closeDetail = useCallback(() => {
    setDetailModal({
      open: false,
      title: "",
      data: [],
      type: "default",
    });
  }, []);

  const loadUserJourney = useCallback(
    async (user) => {
      const slug = eventSlug || (await loadSettings());
      const userId =
        user?.attendee_id || user?.ticket_id || user?.id || user?.user_id;

      if (!slug || !userId) return;

      try {
        setLoadingJourney(true);

        const res = await api.get("/analytics/user-journey", {
          params: {
            event_slug: slug,
            user_id: userId,
          },
        });

        setUserJourney(safeArray(res?.data?.data || res?.data));
      } catch {
        setUserJourney([]);
      } finally {
        setLoadingJourney(false);
      }
    },
    [eventSlug, loadSettings],
  );

  const openUserJourney = useCallback(
    (user) => {
      setSelectedUser(user);
      setUserJourney([]);
      loadUserJourney(user);
    },
    [loadUserJourney],
  );

  const analytics = useMemo(() => {
    const raw = normalizeAnalyticsPayload(data || DEFAULT_ANALYTICS);

    const hourly = safeArray(raw.hourly);
    const gates = safeArray(raw.gate_breakdown);
    const congested = safeArray(raw.congested_gates);
    const topUsers = safeArray(raw.top_users);
    const insideUsers = safeArray(raw.inside_users);

    const totalEntries =
      number(raw.total_entries) ||
      hourly.reduce((sum, item) => sum + number(item.entries), 0);

    const totalExits =
      number(raw.total_exits) ||
      hourly.reduce((sum, item) => sum + number(item.exits), 0);

    const insideNow =
      number(raw.inside_now) ||
      number(raw.currently_inside) ||
      Math.max(totalEntries - totalExits, 0);

    const maxGateEntries = Math.max(...gates.map((g) => number(g.entries)), 0);

    const rankedGates = [...gates]
      .map((g) => {
        const entries = number(g.entries);
        const exits = number(g.exits);
        const status = getGateStatus(entries, maxGateEntries);

        return {
          ...g,
          label: getGateLabel(g),
          code: getGateCode(g),
          entries,
          exits,
          net: Math.max(entries - exits, 0),
          share: totalEntries ? (entries / totalEntries) * 100 : 0,
          status,
        };
      })
      .sort((a, b) => b.entries - a.entries);

    const problemGates = rankedGates.filter((g) => g.status.score >= 2);

    const busiestGate = rankedGates[0] || null;
    const quietestGate = rankedGates[rankedGates.length - 1] || null;

    const computedPeak =
      raw.peak_hour ||
      [...hourly].sort((a, b) => number(b.entries) - number(a.entries))[0] ||
      null;

    const peakHour =
      typeof computedPeak === "string"
        ? { hour: computedPeak, entries: 0 }
        : computedPeak;

    const avgPerGate = gates.length
      ? gates.reduce((sum, item) => sum + number(item.entries), 0) /
        gates.length
      : 0;

    const avgPerHour = hourly.length ? totalEntries / hourly.length : 0;

    const latestHour = hourly[hourly.length - 1];
    const previousHour = hourly[hourly.length - 2];

    const currentEntryRate = latestHour ? number(latestHour.entries) : 0;
    const previousEntryRate = previousHour ? number(previousHour.entries) : 0;

    const hourlyChange = previousEntryRate
      ? ((currentEntryRate - previousEntryRate) / previousEntryRate) * 100
      : 0;

    const predictedAlert = computePrediction(hourly);

    return {
      raw,
      hourly,
      gates,
      rankedGates,
      problemGates,
      congested,
      topUsers,
      insideUsers,
      totalEntries,
      totalExits,
      insideNow,
      busiestGate,
      quietestGate,
      peakHour,
      avgPerGate,
      avgPerHour,
      currentEntryRate,
      hourlyChange,
      predictedAlert,
      ml: raw.ml_scoring,
      anomalies: raw.anomalies,
    };
  }, [computePrediction, data]);

  if (loading && !data) {
    return (
      <LinearGradient colors={["#020617", "#0F172A"]} style={styles.loader}>
        <ActivityIndicator size="large" color="#22C55E" />
        <Text style={styles.loadingText}>Loading Mobile Command Center...</Text>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor="#22C55E"
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
          />
        }
      >
        <HeroHeader
          eventName={eventName}
          eventSlug={eventSlug}
          insideNow={analytics.insideNow}
          lastUpdated={lastUpdated}
          autoRefresh={autoRefresh}
          setAutoRefresh={setAutoRefresh}
          onRefresh={() => load(true)}
        />

        {error ? (
          <AlertBox type="warning" title="Data Warning" message={error} />
        ) : null}

        {analytics.predictedAlert ? (
          <AlertBox
            type="warning"
            title="Predictive Warning"
            message="Traffic is rising quickly. Prepare gate support before congestion forms."
            onPress={() =>
              openDetail("Hourly Traffic Trend", analytics.hourly, "hourly")
            }
          />
        ) : null}

        {analytics.congested.length > 0 ? (
          <AlertBox
            type="danger"
            title="Congestion Detected"
            message={`${analytics.congested.length} gate area needs attention.`}
            onPress={() =>
              openDetail("Congested Gates", analytics.congested, "gate")
            }
          />
        ) : null}

        {number(analytics.anomalies.total_anomalies) > 0 ? (
          <AlertBox
            type="danger"
            title="Anomaly Detection Active"
            message={`${analytics.anomalies.total_anomalies} unusual patterns detected.`}
            onPress={() =>
              openDetail("All System Anomalies", [
                ...safeArray(analytics.anomalies.failed_qr_patterns),
                ...safeArray(analytics.anomalies.gate_pressure),
                ...safeArray(analytics.anomalies.hourly_spikes),
                ...safeArray(analytics.anomalies.flagged_users),
              ])
            }
          />
        ) : null}

        <View style={styles.kpiGrid}>
          <KpiCard
            label="Inside Now"
            value={formatNumber(analytics.insideNow)}
            note="Current occupancy"
            tone="green"
            icon="people"
            onPress={() =>
              openDetail(
                "Currently Inside Users",
                analytics.insideUsers,
                "users",
              )
            }
          />
          <KpiCard
            label="Total Entries"
            value={formatNumber(analytics.totalEntries)}
            note={`Avg ${formatNumber(analytics.avgPerHour)} / hour`}
            tone="blue"
            icon="log-in"
            onPress={() =>
              openDetail("Hourly Entries", analytics.hourly, "hourly")
            }
          />
          <KpiCard
            label="Total Exits"
            value={formatNumber(analytics.totalExits)}
            note="Recorded check-outs"
            tone="amber"
            icon="log-out"
            onPress={() =>
              openDetail("Hourly Exits", analytics.hourly, "hourly")
            }
          />
          <KpiCard
            label="Current Rate"
            value={formatNumber(analytics.currentEntryRate)}
            note={`${analytics.hourlyChange >= 0 ? "+" : ""}${Math.round(
              analytics.hourlyChange,
            )}% from prev hour`}
            tone={analytics.hourlyChange >= 0 ? "red" : "green"}
            icon="trending-up"
            onPress={() =>
              openDetail("Hourly Change", analytics.hourly, "hourly")
            }
          />
        </View>

        <View style={styles.kpiGrid}>
          <KpiCard
            label="Peak Hour"
            value={text(analytics.peakHour?.hour, "-")}
            note={`${formatNumber(analytics.peakHour?.entries)} entries`}
            tone="violet"
            icon="time"
            onPress={() =>
              openDetail(
                "Peak Hour",
                analytics.peakHour ? [analytics.peakHour] : [],
              )
            }
          />
          <KpiCard
            label="Busiest Gate"
            value={text(analytics.busiestGate?.code, "-")}
            note={`${text(analytics.busiestGate?.label, "No gate")} · ${formatNumber(
              analytics.busiestGate?.entries,
            )}`}
            tone="red"
            icon="speedometer"
            onPress={() =>
              openDetail("Busiest Gate", analytics.busiestGate || [], "gate")
            }
          />
          <KpiCard
            label="Quietest Gate"
            value={text(analytics.quietestGate?.code, "-")}
            note={`${text(analytics.quietestGate?.label, "No gate")} · ${formatNumber(
              analytics.quietestGate?.entries,
            )}`}
            tone="cyan"
            icon="remove-circle"
            onPress={() =>
              openDetail("Quietest Gate", analytics.quietestGate || [], "gate")
            }
          />
          <KpiCard
            label="Avg / Gate"
            value={formatNumber(analytics.avgPerGate)}
            note={`${analytics.gates.length} active gates`}
            tone="blue"
            icon="analytics"
            onPress={() =>
              openDetail("All Gates", analytics.rankedGates, "gate")
            }
          />
        </View>

        <SectionTitle
          title="AI Intelligence Layer"
          subtitle="ML scoring and risk signals"
        />

        <View style={styles.kpiGrid}>
          <KpiCard
            label="Engagement"
            value={analytics.ml.avg_engagement_score || 0}
            note="Avg score"
            tone="green"
            icon="sparkles"
            onPress={() =>
              openDetail("Engagement Users", analytics.topUsers, "users")
            }
          />
          <KpiCard
            label="Anomaly"
            value={analytics.ml.avg_anomaly_score || 0}
            note="Avg risk"
            tone="amber"
            icon="warning"
            onPress={() =>
              openDetail("Flagged Users", analytics.ml.flagged_users, "users")
            }
          />
          <KpiCard
            label="High Risk"
            value={analytics.ml.high_risk || 0}
            note="Needs attention"
            tone="red"
            icon="shield"
            onPress={() =>
              openDetail("High Risk Users", analytics.ml.flagged_users, "users")
            }
          />
          <KpiCard
            label="Likely Leave"
            value={analytics.ml.likely_to_leave?.length || 0}
            note="Prediction"
            tone="blue"
            icon="walk"
            onPress={() =>
              openDetail(
                "Likely To Leave Soon",
                analytics.ml.likely_to_leave,
                "users",
              )
            }
          />
        </View>

        <SectionTitle
          title="Traffic Trend"
          subtitle="Entries and exits by hour"
        />

        <ChartCard>
          {analytics.hourly.length ? (
            <LineChart
              data={{
                labels: analytics.hourly
                  .slice(-8)
                  .map((i) => formatHourLabel(text(i.hour, ""))),
                datasets: [
                  {
                    data: analytics.hourly
                      .slice(-8)
                      .map((i) => number(i.entries)),
                    color: () => "#22C55E",
                  },
                  {
                    data: analytics.hourly
                      .slice(-8)
                      .map((i) => number(i.exits)),
                    color: () => "#F59E0B",
                  },
                ],
                legend: ["Entries", "Exits"],
              }}
              width={width - 44}
              height={240}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
            />
          ) : (
            <EmptyState message="Hourly trend data is not available yet." />
          )}
        </ChartCard>

        <SectionTitle
          title="Entry / Exit Mix"
          subtitle="Overall movement distribution"
        />

        <ChartCard>
          {analytics.totalEntries ||
          analytics.totalExits ||
          analytics.insideNow ? (
            <PieChart
              data={[
                {
                  name: "Entries",
                  population: analytics.totalEntries,
                  color: "#22C55E",
                  legendFontColor: "#CBD5E1",
                  legendFontSize: 12,
                },
                {
                  name: "Exits",
                  population: analytics.totalExits,
                  color: "#F59E0B",
                  legendFontColor: "#CBD5E1",
                  legendFontSize: 12,
                },
                {
                  name: "Inside",
                  population: analytics.insideNow,
                  color: "#3B82F6",
                  legendFontColor: "#CBD5E1",
                  legendFontSize: 12,
                },
              ]}
              width={width - 44}
              height={220}
              chartConfig={chartConfig}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="4"
              absolute
            />
          ) : (
            <EmptyState message="Entry / exit mix is not available yet." />
          )}
        </ChartCard>

        <SectionTitle title="Gate Ranking" subtitle="Live pressure by gate" />

        <View style={styles.card}>
          {analytics.rankedGates.length ? (
            analytics.rankedGates
              .slice(0, 12)
              .map((gate, index) => (
                <GateRow
                  key={`${gate.code}-${index}`}
                  gate={gate}
                  index={index}
                  max={analytics.rankedGates[0]?.entries || 1}
                  onPress={() =>
                    openDetail(`${gate.label} Details`, [gate], "gate")
                  }
                />
              ))
          ) : (
            <EmptyState message="Gate data is not available yet." />
          )}
        </View>

        <SectionTitle
          title="Gate Volume Chart"
          subtitle="Top gate comparison"
        />

        <ChartCard>
          {analytics.rankedGates.length ? (
            <BarChart
              data={{
                labels: analytics.rankedGates.slice(0, 6).map((g) => g.code),
                datasets: [
                  {
                    data: analytics.rankedGates
                      .slice(0, 6)
                      .map((g) => number(g.entries)),
                  },
                ],
              }}
              width={width - 44}
              height={240}
              chartConfig={chartConfig}
              style={styles.chart}
              fromZero
              showValuesOnTopOfBars
            />
          ) : (
            <EmptyState message="Gate chart requires gate breakdown data." />
          )}
        </ChartCard>

        <SectionTitle
          title="Operational Recommendations"
          subtitle="Auto-generated actions"
        />

        <View style={styles.recoGrid}>
          <RecommendationCard
            title="Gate Support"
            message={
              analytics.problemGates.length
                ? `Assign support to ${analytics.problemGates
                    .slice(0, 3)
                    .map((g) => g.code)
                    .join(", ")}.`
                : "No immediate gate support required."
            }
            icon="git-merge"
            onPress={() =>
              openDetail("Problem Gates", analytics.problemGates, "gate")
            }
          />

          <RecommendationCard
            title="Queue Risk"
            message={
              analytics.predictedAlert
                ? "Prepare additional scanning devices before the next traffic spike."
                : "Traffic pattern is currently stable."
            }
            icon="pulse"
            onPress={() =>
              openDetail("Queue Risk Data", analytics.hourly, "hourly")
            }
          />

          <RecommendationCard
            title="Occupancy"
            message={
              analytics.insideNow > analytics.totalExits
                ? "Inside count is high. Monitor exit flow and hall capacity."
                : "Entry and exit balance is manageable."
            }
            icon="business"
            onPress={() =>
              openDetail("Occupancy Data", [
                {
                  total_entries: analytics.totalEntries,
                  total_exits: analytics.totalExits,
                  inside_now: analytics.insideNow,
                },
              ])
            }
          />
        </View>

        <SectionTitle
          title="Attendee Intelligence"
          subtitle="Top active users and journey"
        />

        <View style={styles.card}>
          {analytics.topUsers.length ? (
            analytics.topUsers
              .slice(0, 10)
              .map((user, index) => (
                <UserRow
                  key={`${user.id || user.ticket_id || index}`}
                  user={user}
                  index={index}
                  onPress={() => openUserJourney(user)}
                />
              ))
          ) : (
            <EmptyState message="User-level analytics not available yet." />
          )}
        </View>

        <SectionTitle
          title="Flagged Users"
          subtitle="High anomaly or abnormal behavior"
        />

        <View style={styles.card}>
          {analytics.ml.flagged_users?.length ? (
            analytics.ml.flagged_users
              .slice(0, 10)
              .map((user, index) => (
                <FlaggedUserRow
                  key={`${user.id || index}`}
                  user={user}
                  onPress={() => openUserJourney(user)}
                />
              ))
          ) : (
            <EmptyState message="No flagged users detected." />
          )}
        </View>

        <SectionTitle
          title="Likely To Leave Soon"
          subtitle="Predicted from behavior data"
        />

        <View style={styles.card}>
          {analytics.ml.likely_to_leave?.length ? (
            analytics.ml.likely_to_leave
              .slice(0, 10)
              .map((user, index) => (
                <LikelyLeaveRow
                  key={`${user.id || index}`}
                  user={user}
                  index={index}
                  onPress={() => openUserJourney(user)}
                />
              ))
          ) : (
            <EmptyState message="Not enough behavior data for leave prediction." />
          )}
        </View>
      </ScrollView>

      <DetailModal
        visible={detailModal.open}
        title={detailModal.title}
        data={detailModal.data}
        type={detailModal.type}
        onClose={closeDetail}
        onUserPress={(user) => {
          closeDetail();
          openUserJourney(user);
        }}
      />

      <UserJourneyModal
        visible={!!selectedUser}
        user={selectedUser}
        journey={userJourney}
        loading={loadingJourney}
        onClose={() => setSelectedUser(null)}
      />
    </View>
  );
}

function HeroHeader({
  eventName,
  eventSlug,
  insideNow,
  lastUpdated,
  autoRefresh,
  setAutoRefresh,
  onRefresh,
}) {
  return (
    <LinearGradient
      colors={["#0F172A", "#111827", "#1E293B"]}
      style={styles.hero}
    >
      <View style={styles.heroTop}>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE MOBILE COMMAND</Text>
        </View>

        <Pressable onPress={() => setAutoRefresh((v) => !v)}>
          <View
            style={[
              styles.refreshPill,
              autoRefresh && styles.refreshPillActive,
            ]}
          >
            <Ionicons
              name={autoRefresh ? "sync" : "pause"}
              size={14}
              color={autoRefresh ? "#BBF7D0" : "#CBD5E1"}
            />
            <Text style={styles.refreshText}>
              {autoRefresh ? "Auto" : "Paused"}
            </Text>
          </View>
        </Pressable>
      </View>

      <Text style={styles.heroTitle}>Live Event Command Center</Text>
      <Text style={styles.heroSub}>
        {eventName || eventSlug || "No event selected"}
      </Text>

      <View style={styles.heroBottom}>
        <View>
          <Text style={styles.heroValue}>{formatNumber(insideNow)}</Text>
          <Text style={styles.heroLabel}>Inside Venue</Text>
        </View>

        <Pressable onPress={onRefresh} style={styles.manualRefresh}>
          <Ionicons name="refresh" size={18} color="#FFFFFF" />
          <Text style={styles.manualRefreshText}>
            {lastUpdated ? format12Hour(lastUpdated) : "Refresh"}
          </Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

function AlertBox({ type = "warning", title, message, onPress }) {
  const danger = type === "danger";

  return (
    <Pressable onPress={onPress}>
      <View
        style={[
          styles.alertBox,
          {
            borderColor: danger
              ? "rgba(239,68,68,0.45)"
              : "rgba(245,158,11,0.45)",
            backgroundColor: danger
              ? "rgba(127,29,29,0.38)"
              : "rgba(120,53,15,0.38)",
          },
        ]}
      >
        <Ionicons
          name={danger ? "warning" : "alert-circle"}
          size={24}
          color={danger ? "#FCA5A5" : "#FCD34D"}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.alertTitle}>{title}</Text>
          <Text style={styles.alertMessage}>{message}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function KpiCard({ label, value, note, tone, icon, onPress }) {
  const color = toneColor(tone);

  return (
    <Pressable style={styles.kpiPress} onPress={onPress}>
      <LinearGradient
        colors={["rgba(15,23,42,0.98)", "rgba(30,41,59,0.9)"]}
        style={styles.kpiCard}
      >
        <View style={styles.kpiTop}>
          <View style={[styles.kpiIcon, { backgroundColor: color }]}>
            <Ionicons name={icon || "analytics"} size={17} color="#FFFFFF" />
          </View>
          <Ionicons name="chevron-forward" size={16} color="#64748B" />
        </View>

        <Text style={[styles.kpiValue, { color }]} numberOfLines={1}>
          {value}
        </Text>
        <Text style={styles.kpiLabel}>{label}</Text>
        <Text style={styles.kpiNote} numberOfLines={2}>
          {note}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSub}>{subtitle}</Text>
    </View>
  );
}

function ChartCard({ children }) {
  return <View style={styles.chartCard}>{children}</View>;
}

function GateRow({ gate, index, max, onPress }) {
  const color = toneColor(gate.status.tone);

  const percent = max > 0 ? Math.min(100, (gate.entries / max) * 100) : 0;

  const intensity =
    percent >= 85
      ? "Critical Pressure"
      : percent >= 65
        ? "High Traffic"
        : percent >= 40
          ? "Moderate Flow"
          : "Low Traffic";

  const intensityColor =
    percent >= 85
      ? "#EF4444"
      : percent >= 65
        ? "#F59E0B"
        : percent >= 40
          ? "#3B82F6"
          : "#22C55E";

  return (
    <Pressable style={styles.gateCard} onPress={onPress}>
      {/* ================= HEADER ================= */}

      <View style={styles.gateHeader}>
        <View style={styles.gateLeft}>
          <View style={[styles.rankBadge, { backgroundColor: color }]}>
            <Text style={styles.rankText}>#{index + 1}</Text>
          </View>

          <View>
            <Text style={styles.gateTitle}>{gate.label}</Text>

            <Text style={styles.gateSubtitle}>{gate.code}</Text>
          </View>
        </View>

        <View
          style={[
            styles.liveStatus,
            {
              backgroundColor: `${color}22`,
              borderColor: color,
            },
          ]}
        >
          <View style={[styles.liveDotSmall, { backgroundColor: color }]} />

          <Text style={[styles.liveStatusText, { color }]}>
            {gate.status.label}
          </Text>
        </View>
      </View>

      {/* ================= TRAFFIC BAR ================= */}

      <View style={styles.trafficWrapper}>
        <View style={styles.trafficTrack}>
          <LinearGradient
            colors={[intensityColor, `${intensityColor}99`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.trafficFill,
              {
                width: `${percent}%`,
              },
            ]}
          />
        </View>

        <View style={styles.trafficLabels}>
          <Text style={[styles.intensityText, { color: intensityColor }]}>
            {intensity}
          </Text>

          <Text style={styles.percentText}>{Math.round(percent)}%</Text>
        </View>
      </View>

      {/* ================= METRICS ================= */}

      <View style={styles.metricGrid}>
        <View style={styles.metricBox}>
          <Ionicons name="log-in" size={16} color="#22C55E" />
          <Text style={styles.metricValue}>{formatNumber(gate.entries)}</Text>
          <Text style={styles.metricLabel}>Entries</Text>
        </View>

        <View style={styles.metricBox}>
          <Ionicons name="log-out" size={16} color="#F59E0B" />
          <Text style={styles.metricValue}>{formatNumber(gate.exits)}</Text>
          <Text style={styles.metricLabel}>Exits</Text>
        </View>

        <View style={styles.metricBox}>
          <Ionicons name="people" size={16} color="#3B82F6" />
          <Text style={styles.metricValue}>{formatNumber(gate.net)}</Text>
          <Text style={styles.metricLabel}>Net</Text>
        </View>

        <View style={styles.metricBox}>
          <Ionicons name="pie-chart" size={16} color="#A855F7" />
          <Text style={styles.metricValue}>{Math.round(gate.share)}%</Text>
          <Text style={styles.metricLabel}>Share</Text>
        </View>
      </View>
    </Pressable>
  );
}

function RecommendationCard({ title, message, icon, onPress }) {
  return (
    <Pressable style={styles.recoCard} onPress={onPress}>
      <Ionicons name={icon || "bulb"} size={24} color="#22C55E" />
      <Text style={styles.recoTitle}>{title}</Text>
      <Text style={styles.recoText}>{message}</Text>
    </Pressable>
  );
}

function UserRow({ user, index, onPress }) {
  const total =
    user.total_time_minutes ||
    user.total_inside_minutes ||
    user.total_inside_time ||
    0;

  return (
    <Pressable style={styles.userRow} onPress={onPress}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{text(user.name, "U").charAt(0)}</Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.userName}>
          #{index + 1} {text(user.name, "Unknown Attendee")}
        </Text>
        <Text style={styles.userCompany}>
          {text(user.company || user.organization)}
        </Text>
        <Text style={styles.userMini}>
          {text(user.last_gate, "No gate")} ·{" "}
          {text(user.last_activity, "No activity")}
        </Text>
      </View>

      <View style={styles.userRight}>
        <Text style={styles.userTime}>{formatMinutes(total)}</Text>
        <Text
          style={[
            styles.userStatus,
            {
              color: user.status_color === "green" ? "#22C55E" : "#94A3B8",
            },
          ]}
        >
          {text(user.status, "Unknown")}
        </Text>
      </View>
    </Pressable>
  );
}

function FlaggedUserRow({ user, onPress }) {
  return (
    <Pressable style={styles.flaggedRow} onPress={onPress}>
      <View>
        <Text style={styles.userName}>{text(user.name, "Unknown User")}</Text>
        <Text style={styles.userMini}>
          {safeArray(user.anomaly_flags || user.flags).join(", ") ||
            "Flagged activity"}
        </Text>
      </View>

      <View style={{ alignItems: "flex-end" }}>
        <Text style={styles.riskScore}>
          {text(user.anomaly_score || user.score, 0)}
        </Text>
        <Text style={styles.userMini}>{text(user.risk_level, "Risk")}</Text>
      </View>
    </Pressable>
  );
}

function LikelyLeaveRow({ user, index, onPress }) {
  return (
    <Pressable style={styles.flaggedRow} onPress={onPress}>
      <View>
        <Text style={styles.userName}>
          #{index + 1} {text(user.name, "Unknown User")}
        </Text>
        <Text style={styles.userMini}>
          {text(user.segment, "Unknown segment")}
        </Text>
      </View>

      <View style={{ alignItems: "flex-end" }}>
        <Text style={styles.leaveScore}>
          {text(user.leave_probability, 0)}%
        </Text>
        <Text style={styles.userMini}>Probability</Text>
      </View>
    </Pressable>
  );
}

function EmptyState({ message }) {
  return (
    <View style={styles.empty}>
      <Ionicons name="information-circle-outline" size={28} color="#94A3B8" />
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

function DetailModal({ visible, title, data, type, onClose, onUserPress }) {
  const [search, setSearch] = useState("");

  const cleanData = useMemo(() => safeArray(data), [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cleanData;

    return cleanData.filter((item) =>
      JSON.stringify(item || {})
        .toLowerCase()
        .includes(q),
    );
  }, [cleanData, search]);

  function renderValue(value, key = "") {
    if (value === null || value === undefined || value === "") {
      return "-";
    }

    /* ---------------- ARRAY ---------------- */

    if (Array.isArray(value)) {
      return value.join(", ");
    }

    /* ---------------- GATE OBJECT ---------------- */

    if (typeof value === "object" && (value.name || value.code || value.gate)) {
      return value.name || value.code || value.gate?.name || "Gate";
    }

    /* ---------------- GENERIC OBJECT ---------------- */

    if (typeof value === "object") {
      // prettier user-readable formatting

      return Object.entries(value)
        .map(([k, v]) => {
          if (v === null || v === undefined || v === "") {
            return null;
          }

          if (typeof v === "object") {
            return null;
          }

          return `${k}: ${v}`;
        })
        .filter(Boolean)
        .join(" • ");
    }
    if (
      key.includes("time") ||
      key.includes("date") ||
      key.includes("created") ||
      key.includes("updated") ||
      key.includes("scanned")
    ) {
      return format12Hour(value);
    }
    return String(value);
  }

  function renderItem({ item }) {
    const keys = Object.keys(item || {}).filter(
      (k) => !["gate", "meta", "flags", "anomaly_flags"].includes(k),
    );

    return (
      <Pressable
        style={styles.detailItem}
        onPress={() => {
          if (type === "users") onUserPress?.(item);
        }}
      >
        {keys.map((key) => (
          <View key={key} style={styles.detailRow}>
            <Text style={styles.detailKey}>
              {key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
            </Text>
            <Text style={styles.detailValue} numberOfLines={2}>
              {renderValue(item[key], key)}
            </Text>
          </View>
        ))}
      </Pressable>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHandle} />

          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{title}</Text>
              <Text style={styles.modalSub}>
                Showing {filtered.length} of {cleanData.length} records
              </Text>
            </View>

            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </Pressable>
          </View>

          <TextInput
            placeholder="Search anything..."
            placeholderTextColor="#64748B"
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
          />

          {filtered.length ? (
            <FlatList
              data={filtered}
              keyExtractor={(_, index) => String(index)}
              renderItem={renderItem}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <EmptyState message="No matching data found." />
          )}
        </View>
      </View>
    </Modal>
  );
}

function UserJourneyModal({ visible, user, journey, loading, onClose }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHandle} />

          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>
                {text(user?.name, "Attendee Journey")}
              </Text>
              <Text style={styles.modalSub}>
                Full IN / OUT movement history
              </Text>
            </View>

            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.journeyLoader}>
              <ActivityIndicator color="#22C55E" />
              <Text style={styles.emptyText}>Loading journey...</Text>
            </View>
          ) : safeArray(journey).length ? (
            <FlatList
              data={safeArray(journey)}
              keyExtractor={(_, index) => String(index)}
              renderItem={({ item, index }) => (
                <View style={styles.journeyItem}>
                  <View style={styles.timelineDot} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.journeyType,
                        {
                          color:
                            item.type === "IN" || item.direction === "IN"
                              ? "#22C55E"
                              : "#F59E0B",
                        },
                      ]}
                    >
                      {text(item.type || item.direction, "SCAN")}
                    </Text>
                    <Text style={styles.journeyMeta}>
                      {format12Hour(
                        item.time || item.scanned_at || item.created_at,
                      )}
                    </Text>
                    <Text style={styles.journeyGate}>
                      {text(item.gate || item.gate_name)}
                    </Text>
                  </View>
                </View>
              )}
            />
          ) : (
            <EmptyState message="No journey data found for this attendee." />
          )}
        </View>
      </View>
    </Modal>
  );
}

const chartConfig = {
  backgroundGradientFrom: "#0F172A",
  backgroundGradientTo: "#0F172A",
  decimalPlaces: 0,
  color: () => "#22C55E",
  labelColor: () => "#CBD5E1",
  propsForDots: {
    r: "4",
    strokeWidth: "2",
    stroke: "#22C55E",
  },
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#020617",
  },

  container: {
    flex: 1,
    padding: 16,
  },

  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    color: "#FFFFFF",
    marginTop: 14,
    fontWeight: "800",
  },

  hero: {
    borderRadius: 32,
    padding: 22,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  livePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(34,197,94,0.14)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },

  liveDot: {
    width: 9,
    height: 9,
    borderRadius: 9,
    backgroundColor: "#22C55E",
    marginRight: 8,
  },

  liveText: {
    color: "#BBF7D0",
    fontWeight: "900",
    fontSize: 11,
  },

  refreshPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },

  refreshPillActive: {
    backgroundColor: "rgba(34,197,94,0.14)",
  },

  refreshText: {
    color: "#CBD5E1",
    fontWeight: "800",
    fontSize: 12,
  },

  heroTitle: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 24,
  },

  heroSub: {
    color: "#94A3B8",
    marginTop: 7,
    fontWeight: "700",
  },

  heroBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 26,
  },

  heroValue: {
    color: "#FFFFFF",
    fontSize: 48,
    fontWeight: "900",
  },

  heroLabel: {
    color: "#94A3B8",
    fontWeight: "800",
  },

  manualRefresh: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
  },

  manualRefreshText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 12,
  },

  alertBox: {
    flexDirection: "row",
    gap: 12,
    padding: 15,
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 14,
  },

  alertTitle: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
  },

  alertMessage: {
    color: "#CBD5E1",
    marginTop: 4,
    lineHeight: 19,
    fontWeight: "600",
  },

  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 4,
  },

  kpiPress: {
    width: "48%",
    marginBottom: 14,
  },

  kpiCard: {
    minHeight: 155,
    padding: 16,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },

  kpiTop: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  kpiIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  kpiValue: {
    fontSize: 29,
    fontWeight: "900",
    marginTop: 16,
  },

  kpiLabel: {
    color: "#FFFFFF",
    fontWeight: "900",
    marginTop: 4,
  },

  kpiNote: {
    color: "#94A3B8",
    fontWeight: "700",
    fontSize: 12,
    marginTop: 5,
  },

  sectionHead: {
    marginTop: 24,
    marginBottom: 10,
  },

  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "900",
  },

  sectionSub: {
    color: "#94A3B8",
    fontWeight: "700",
    marginTop: 4,
  },

  card: {
    backgroundColor: "rgba(15,23,42,0.96)",
    borderRadius: 26,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },

  chartCard: {
    backgroundColor: "rgba(15,23,42,0.96)",
    borderRadius: 26,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },

  chart: {
    borderRadius: 18,
  },

  gateRow: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },

  gateTop: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  gateName: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  gateCode: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "700",
  },

  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  statusText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 11,
  },

  progressTrack: {
    height: 9,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 13,
  },

  progressFill: {
    height: "100%",
    borderRadius: 999,
  },

  gateMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 9,
  },

  gateMetaText: {
    color: "#94A3B8",
    fontWeight: "800",
    fontSize: 12,
  },

  recoGrid: {
    gap: 12,
  },

  recoCard: {
    backgroundColor: "rgba(15,23,42,0.96)",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },

  recoTitle: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
    marginTop: 10,
  },

  recoText: {
    color: "#94A3B8",
    marginTop: 7,
    lineHeight: 20,
    fontWeight: "700",
  },

  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#22C55E",
  },

  avatarText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 20,
  },

  userName: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  userCompany: {
    color: "#94A3B8",
    marginTop: 4,
    fontWeight: "700",
  },

  userMini: {
    color: "#64748B",
    marginTop: 4,
    fontWeight: "700",
    fontSize: 12,
  },

  userRight: {
    alignItems: "flex-end",
  },

  userTime: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  userStatus: {
    marginTop: 4,
    fontWeight: "900",
    fontSize: 12,
  },

  flaggedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },

  riskScore: {
    color: "#EF4444",
    fontWeight: "900",
    fontSize: 18,
  },

  leaveScore: {
    color: "#3B82F6",
    fontWeight: "900",
    fontSize: 18,
  },

  empty: {
    paddingVertical: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyText: {
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 8,
    fontWeight: "700",
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    justifyContent: "flex-end",
  },

  bottomSheet: {
    backgroundColor: "#0F172A",
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    padding: 20,
    maxHeight: "88%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  sheetHandle: {
    width: 54,
    height: 5,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "center",
    marginBottom: 16,
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    marginBottom: 14,
  },

  modalTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
  },

  modalSub: {
    color: "#94A3B8",
    marginTop: 4,
    fontWeight: "700",
  },

  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.09)",
    alignItems: "center",
    justifyContent: "center",
  },

  searchInput: {
    backgroundColor: "#020617",
    color: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 14,
    fontWeight: "700",
  },

  detailItem: {
    backgroundColor: "rgba(2,6,23,0.75)",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    marginBottom: 10,
  },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
    paddingVertical: 5,
  },

  detailKey: {
    color: "#94A3B8",
    fontWeight: "800",
    flex: 1,
  },

  detailValue: {
    color: "#FFFFFF",
    fontWeight: "800",
    textAlign: "right",
    flex: 1.2,
  },

  journeyLoader: {
    paddingVertical: 40,
    alignItems: "center",
  },

  journeyItem: {
    flexDirection: "row",
    gap: 13,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },

  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#22C55E",
    marginTop: 5,
  },

  journeyType: {
    fontWeight: "900",
    fontSize: 16,
  },

  journeyMeta: {
    color: "#94A3B8",
    marginTop: 4,
    fontWeight: "700",
  },

  journeyGate: {
    color: "#FFFFFF",
    marginTop: 4,
    fontWeight: "800",
  },
  gateCard: {
    backgroundColor: "rgba(2,6,23,0.92)",
    borderRadius: 28,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },

  gateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  gateLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  rankBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  rankText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },

  gateTitle: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },

  gateSubtitle: {
    color: "#64748B",
    marginTop: 4,
    fontWeight: "700",
  },

  liveStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },

  liveDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 8,
  },

  liveStatusText: {
    fontWeight: "900",
    fontSize: 11,
  },

  trafficWrapper: {
    marginTop: 18,
  },

  trafficTrack: {
    height: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    overflow: "hidden",
  },

  trafficFill: {
    height: "100%",
    borderRadius: 999,
  },

  trafficLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },

  intensityText: {
    fontWeight: "900",
    fontSize: 12,
  },

  percentText: {
    color: "#CBD5E1",
    fontWeight: "900",
  },

  metricGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
  },

  metricBox: {
    alignItems: "center",
    flex: 1,
  },

  metricValue: {
    color: "#FFFFFF",
    fontWeight: "900",
    marginTop: 6,
    fontSize: 15,
  },

  metricLabel: {
    color: "#64748B",
    marginTop: 4,
    fontWeight: "700",
    fontSize: 11,
  },
});
