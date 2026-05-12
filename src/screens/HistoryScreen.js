import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  SafeAreaView,
  Alert,
  RefreshControl,
  ScrollView,
  FlatList,
  Animated,
} from "react-native";

import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";

import { Searchbar, Chip, Button } from "react-native-paper";

import {
  RefreshCcw,
  Download,
  Trash2,
  Users,
  ScanLine,
  ArrowRightCircle,
  ArrowLeftCircle,
  AlertTriangle,
  CloudOff,
  Clock3,
  Building2,
  Briefcase,
  QrCode,
  MapPin,
  X,
  ShieldCheck,
  Search,
  Activity,
  Copy,
  Sparkles,
} from "lucide-react-native";

import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

import { getAnalyticsOverview } from "../api/analytics";

import { getSettings } from "../storage/settings";
import { useRole } from "../context/RoleContext";

const COLORS = {
  bg: "#020617",
  card: "rgba(15,23,42,0.82)",
  card2: "rgba(30,41,59,0.64)",
  border: "rgba(255,255,255,0.07)",
  white: "#FFFFFF",
  text: "#CBD5E1",
  muted: "#94A3B8",
  darkMuted: "#64748B",
  green: "#22C55E",
  blue: "#3B82F6",
  red: "#EF4444",
  amber: "#F59E0B",
  violet: "#8B5CF6",
  cyan: "#06B6D4",
};

function safeText(v, fallback = "—") {
  if (v === null || v === undefined || v === "") return fallback;
  return String(v);
}

function normalizeStatus(status) {
  if (!status) return "UNKNOWN";
  const s = String(status).toUpperCase();
  if (s === "OFFLINE_SAVED") return "OFFLINE";
  return s;
}

function getQR(item) {
  return (
    item?.qr_code ||
    item?.qr ||
    item?.code ||
    item?.ticket_code ||
    item?.qrCode ||
    item?.data?.qr_code ||
    item?.data?.qr ||
    ""
  );
}

function getName(item) {
  return item?.attendee?.name || "Unknown Guest";
}

function getCompany(item) {
  return item?.attendee?.company || "No Company";
}

function getDesignation(item) {
  return item?.attendee?.designation || "Attendee";
}

function getScannerName(item) {
  return item?.scanner?.name || "Unknown Scanner";
}

function getScannerEmail(item) {
  return item?.scanner?.email || "No Email";
}

function getGate(item) {
  return (
    item?.gate ||
    item?.gate_name ||
    item?.gate_code ||
    item?.data?.gate ||
    item?.data?.gate_name ||
    "Main Gate"
  );
}

function getDirection(item) {
  return String(item?.direction || item?.data?.direction || "").toUpperCase();
}

function getTime(item) {
  const raw =
    item?.time_label ||
    item?.time ||
    item?.created_at ||
    item?.data?.time_label ||
    item?.ts ||
    "";

  return format12Hour(raw);
}

function format12Hour(value) {
  if (!value) return "—";

  try {
    const text = String(value);

    // already formatted
    if (text.includes("AM") || text.includes("PM")) {
      return text;
    }

    // timestamp
    if (typeof value === "number") {
      return new Date(value).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    }

    // valid datetime
    const d = new Date(value);

    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    }

    // raw HH:mm:ss
    if (text.includes(":")) {
      const parts = text.split(":");

      let h = Number(parts[0]);

      const m = parts[1] || "00";

      const s = parts[2] || "00";

      const suffix = h >= 12 ? "PM" : "AM";

      h = h % 12 || 12;

      return `${h}:${m}:${s} ${suffix}`;
    }

    return text;
  } catch {
    return String(value);
  }
}

function getStatusColor(status) {
  const s = normalizeStatus(status);

  if (s === "SUCCESS") return COLORS.green;
  if (s === "FAIL" || s === "INVALID") return COLORS.red;
  if (s === "OFFLINE") return COLORS.blue;
  if (s === "DUPLICATE") return COLORS.amber;

  return COLORS.muted;
}

function getStatusIcon(status, size = 16, color = COLORS.white) {
  const s = normalizeStatus(status);

  if (s === "SUCCESS") return <ShieldCheck size={size} color={color} />;
  if (s === "OFFLINE") return <CloudOff size={size} color={color} />;
  if (s === "DUPLICATE") return <AlertTriangle size={size} color={color} />;
  if (s === "FAIL" || s === "INVALID") return <X size={size} color={color} />;

  return <Activity size={size} color={color} />;
}

function getDirectionIcon(direction, color = COLORS.muted, size = 16) {
  const d = String(direction || "").toUpperCase();

  if (d === "IN") return <ArrowRightCircle size={size} color={color} />;
  if (d === "OUT") return <ArrowLeftCircle size={size} color={color} />;

  return <Activity size={size} color={color} />;
}

function getHumanActivity(item) {
  const status = normalizeStatus(item?.status);
  const direction = getDirection(item);
  const firstName = getName(item).split(" ")[0].trim() || "Guest";

  if (status === "SUCCESS") {
    if (direction === "IN")
      return `${firstName} entered the venue successfully.`;
    if (direction === "OUT")
      return `${firstName} exited the venue successfully.`;
    return `${firstName}'s scan was successful.`;
  }

  if (status === "DUPLICATE") {
    if (direction === "IN") return `${firstName} was already inside the venue.`;
    if (direction === "OUT") return `${firstName} had already exited earlier.`;
    return `${firstName}'s scan was detected as duplicate.`;
  }

  if (status === "INVALID" || status === "FAIL") {
    return item?.message || `${firstName} could not access the venue.`;
  }

  if (status === "OFFLINE") {
    return `${firstName}'s scan was saved offline and will sync automatically.`;
  }

  return item?.message || "Activity recorded.";
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function getHourGroup(item) {
  const raw = item?.ts || item?.created_at || item?.time_label;

  if (typeof raw === "number") {
    const d = new Date(raw);
    let h = d.getHours();
    const suffix = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:00 ${suffix}`;
  }

  const time = getTime(item);
  if (time && time.length >= 5) return time.slice(0, 5);

  return "—";
}

export default function HistoryScreen() {
  const { role } = useRole();

  const pulse = useRef(new Animated.Value(1)).current;

  const [items, setItems] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [selected, setSelected] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.35,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  async function load() {
    try {
      const settings = await getSettings();

      const slug = settings?.event?.slug;

      if (!slug) {
        return;
      }

      const analyticsData = await getAnalyticsOverview(slug);

      // console.log(
      //   "LIVE ANALYTICS:",
      //   analyticsData?.currently_inside,
      //   analyticsData?.recent_activity?.length,
      // );

      setAnalytics(analyticsData);

      const history = Array.isArray(analyticsData?.recent_activity)
        ? analyticsData.recent_activity
        : [];

      setItems(history.length ? [...history] : []);
    } catch (e) {
      // console.log("HISTORY LOAD ERROR:", e);
      // console.log("Keeping previous history due to API error");
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, []);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const summary = useMemo(() => {
    let inCount = 0;
    let outCount = 0;
    let success = 0;
    let fail = 0;
    let offline = 0;
    let duplicate = 0;

    items.forEach((it) => {
      const status = normalizeStatus(it.status);
      const direction = getDirection(it);

      if (direction === "IN") inCount++;
      if (direction === "OUT") outCount++;

      if (status === "SUCCESS") success++;
      if (status === "FAIL" || status === "INVALID") fail++;
      if (status === "OFFLINE") offline++;
      if (status === "DUPLICATE") duplicate++;
    });

    return {
      total: items.length,
      inCount,
      outCount,
      success,
      fail,
      offline,
      duplicate,
      insideNow: Number(
        analytics?.currently_inside ??
          analytics?.inside_now ??
          analytics?.current_inside ??
          0,
      ),
    };
  }, [JSON.stringify(items), analytics]);

  const peakHour = useMemo(() => {
    const map = {};

    items.forEach((it) => {
      const h = getHourGroup(it);
      if (!map[h]) map[h] = 0;
      map[h]++;
    });

    let top = "—";
    let max = 0;

    Object.entries(map).forEach(([hour, count]) => {
      if (count > max) {
        max = count;
        top = hour;
      }
    });

    return top;
  }, [items]);

  const gateAnalytics = useMemo(() => {
    const map = {};

    items.forEach((it) => {
      const gate = getGate(it);
      if (!map[gate]) map[gate] = 0;
      map[gate]++;
    });

    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [items]);

  const filtered = useMemo(() => {
    let list = [...items];

    if (filter !== "ALL") {
      list = list.filter((it) => {
        const status = normalizeStatus(it.status);
        const direction = getDirection(it);

        if (filter === "IN") return direction === "IN";
        if (filter === "OUT") return direction === "OUT";
        if (filter === "SUCCESS") return status === "SUCCESS";
        if (filter === "FAIL") return status === "FAIL" || status === "INVALID";
        if (filter === "OFFLINE") return status === "OFFLINE";
        if (filter === "DUPLICATE") return status === "DUPLICATE";

        return true;
      });
    }

    const qq = q.trim().toLowerCase();

    if (qq) {
      list = list.filter((it) => {
        const hay = `
          ${getQR(it)}
          ${getName(it)}
          ${getCompany(it)}
          ${getDesignation(it)}
          ${getDirection(it)}
          ${normalizeStatus(it.status)}
          ${getGate(it)}
          ${it.message || ""}
        `.toLowerCase();

        return hay.includes(qq);
      });
    }

    return list;
  }, [JSON.stringify(items), q, filter]);

  async function exportCSV() {
    try {
      if (!items.length) {
        Alert.alert("No data", "There is no scan history to export.");
        return;
      }

      const header = [
        "Name",
        "Designation",
        "Company",
        "QR Code",
        "Gate",
        "Direction",
        "Status",
        "Time",
        "Message",
      ];

      const rows = items.map((it) => [
        getName(it),
        getDesignation(it),
        getCompany(it),
        getQR(it),
        getGate(it),
        getDirection(it),
        normalizeStatus(it.status),
        getTime(it),
        it.message || "",
      ]);

      const csv = [header, ...rows]
        .map((row) => row.map(csvEscape).join(","))
        .join("\n");

      const path = FileSystem.cacheDirectory + `scan-history-${Date.now()}.csv`;

      await FileSystem.writeAsStringAsync(path, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("Export ready", path);
        return;
      }

      await Sharing.shareAsync(path);
    } catch {
      Alert.alert("Export failed", "Could not export scan history.");
    }
  }

  async function clearAll() {
    Alert.alert("Clear history?", "This will remove all local scan history.", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          Alert.alert(
            "Disabled",
            "History is now managed from server analytics.",
          );
        },
      },
    ]);
  }

  return (
    <LinearGradient
      colors={["#020617", "#071126", "#0F172A", "#111827"]}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container}>
        <FlatList
          data={filtered}
          extraData={items.length + refreshing}
          keyExtractor={(item, index) =>
            String(item.id ?? `${getQR(item)}-${index}`)
          }
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor="#FFFFFF"
            />
          }
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={10}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <>
              <BlurView intensity={42} tint="dark" style={styles.hero}>
                <View style={styles.heroTop}>
                  <View style={styles.liveBadge}>
                    <Animated.View
                      style={[
                        styles.liveDot,
                        {
                          transform: [{ scale: pulse }],
                        },
                      ]}
                    />
                    <Text style={styles.liveText}>Live Command</Text>
                  </View>

                  <View style={styles.actionRow}>
                    <IconButton onPress={refresh}>
                      <RefreshCcw size={18} color="#FFFFFF" />
                    </IconButton>

                    <IconButton onPress={exportCSV}>
                      <Download size={18} color="#FFFFFF" />
                    </IconButton>

                    {role === "ADMIN" ? (
                      <IconButton danger onPress={clearAll}>
                        <Trash2 size={18} color="#FFFFFF" />
                      </IconButton>
                    ) : null}
                  </View>
                </View>

                <View style={styles.heroTitleRow}>
                  <View>
                    <Text style={styles.title}>Event Activity</Text>
                    <Text style={styles.subtitle}>
                      {filtered.length} visible from {summary.total} total scans
                    </Text>
                  </View>

                  <View style={styles.sparkBox}>
                    <Sparkles size={20} color="#FFFFFF" />
                  </View>
                </View>

                <View style={styles.primaryMetric}>
                  <View>
                    <Text style={styles.primaryLabel}>Inside Venue</Text>
                    <Text style={styles.primaryValue}>{summary.insideNow}</Text>
                    <Text style={styles.primaryHint}>
                      Real-time occupancy estimate
                    </Text>
                  </View>

                  <View style={styles.primaryIcon}>
                    <Users size={30} color="#FFFFFF" />
                  </View>
                </View>

                <View style={styles.metricGrid}>
                  <MetricCard
                    label="Total Scans"
                    value={summary.total}
                    color={COLORS.blue}
                    icon={<ScanLine size={18} color="#FFFFFF" />}
                  />

                  <MetricCard
                    label="Successful"
                    value={summary.success}
                    color={COLORS.green}
                    icon={<ShieldCheck size={18} color="#FFFFFF" />}
                  />

                  <MetricCard
                    label="Failed"
                    value={summary.fail}
                    color={COLORS.red}
                    icon={<AlertTriangle size={18} color="#FFFFFF" />}
                  />

                  <MetricCard
                    label="Peak Hour"
                    value={peakHour}
                    color={COLORS.cyan}
                    icon={<Clock3 size={18} color="#FFFFFF" />}
                  />
                </View>
              </BlurView>

              <View style={styles.searchShell}>
                <Searchbar
                  placeholder="Search attendee, QR, company..."
                  value={q}
                  onChangeText={setQ}
                  style={styles.search}
                  inputStyle={styles.searchInput}
                  icon={() => <Search size={20} color={COLORS.muted} />}
                  placeholderTextColor={COLORS.darkMuted}
                />
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterWrap}
              >
                {[
                  "ALL",
                  "IN",
                  "OUT",
                  "SUCCESS",
                  "FAIL",
                  "OFFLINE",
                  "DUPLICATE",
                ].map((f) => (
                  <Chip
                    key={f}
                    selected={filter === f}
                    onPress={() => setFilter(f)}
                    style={[
                      styles.filterChip,
                      filter === f && styles.filterChipActive,
                    ]}
                    textStyle={[
                      styles.filterText,
                      filter === f && styles.filterTextActive,
                    ]}
                  >
                    {f}
                  </Chip>
                ))}
              </ScrollView>

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Gate Pulse</Text>
                <Text style={styles.sectionSub}>Top active gates</Text>
              </View>

              <View style={styles.gatePanel}>
                {gateAnalytics.length ? (
                  gateAnalytics.map(([gate, count], index) => (
                    <View key={`${gate}-${index}`} style={styles.gateRow}>
                      <View style={styles.gateLeft}>
                        <View style={styles.gateRank}>
                          <Text style={styles.gateRankText}>{index + 1}</Text>
                        </View>

                        <View>
                          <Text style={styles.gateName}>{gate}</Text>
                          <Text style={styles.gateHint}>
                            Live activity stream
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.gateCount}>{count} scans</Text>
                    </View>
                  ))
                ) : (
                  <EmptyState />
                )}
              </View>

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Live Timeline</Text>
                <Text style={styles.sectionSub}>Latest scan activities</Text>
              </View>
            </>
          }
          ListEmptyComponent={<EmptyState large />}
          renderItem={({ item }) => (
            <ActivityCard item={item} onPress={() => setSelected(item)} />
          )}
        />

        <Modal
          visible={!!selected}
          transparent
          animationType="slide"
          onRequestClose={() => setSelected(null)}
        >
          <View style={styles.sheetBackdrop}>
            <Pressable
              style={styles.sheetOverlay}
              onPress={() => setSelected(null)}
            />

            <BlurView intensity={60} tint="dark" style={styles.sheet}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.sheetContent}
              >
                <View style={styles.sheetHandle} />

                <View style={styles.sheetTop}>
                  <View
                    style={[
                      styles.sheetAvatar,
                      { backgroundColor: getStatusColor(selected?.status) },
                    ]}
                  >
                    <Text style={styles.sheetAvatarText}>
                      {getName(selected || {})
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  </View>

                  <Pressable
                    style={styles.closeBtn}
                    onPress={() => setSelected(null)}
                  >
                    <X size={22} color="#FFFFFF" />
                  </Pressable>
                </View>

                <View
                  style={[
                    styles.statusLarge,
                    {
                      backgroundColor: `${getStatusColor(selected?.status)}22`,
                    },
                  ]}
                >
                  {getStatusIcon(
                    selected?.status,
                    16,
                    getStatusColor(selected?.status),
                  )}
                  <Text
                    style={[
                      styles.statusLargeText,
                      { color: getStatusColor(selected?.status) },
                    ]}
                  >
                    {normalizeStatus(selected?.status)}
                  </Text>
                </View>

                <Text style={styles.sheetName}>{getName(selected || {})}</Text>

                <Text style={styles.sheetSub}>
                  {[getDesignation(selected || {}), getCompany(selected || {})]
                    .filter(Boolean)
                    .join(" • ") || "Attendee"}
                </Text>

                <Text style={styles.sheetMessage}>
                  {getHumanActivity(selected || {})}
                </Text>

                <View style={styles.quickGrid}>
                  <QuickCard
                    label="Direction"
                    value={getDirection(selected || {}) || "—"}
                    icon={getDirectionIcon(
                      getDirection(selected || {}),
                      COLORS.white,
                      20,
                    )}
                  />

                  <QuickCard
                    label="Gate"
                    value={getGate(selected || {})}
                    icon={<MapPin size={20} color="#FFFFFF" />}
                  />
                </View>

                <View style={styles.detailBox}>
                  <DetailRow
                    icon={<QrCode size={16} color={COLORS.muted} />}
                    label="QR Code"
                    value={getQR(selected || {})}
                  />
                  <DetailRow
                    icon={<Users size={16} color={COLORS.muted} />}
                    label="Name"
                    value={getName(selected || {})}
                  />
                  <DetailRow
                    icon={<Briefcase size={16} color={COLORS.muted} />}
                    label="Designation"
                    value={getDesignation(selected || {})}
                  />
                  <DetailRow
                    icon={<Building2 size={16} color={COLORS.muted} />}
                    label="Company"
                    value={getCompany(selected || {})}
                  />
                  <DetailRow
                    icon={<MapPin size={16} color={COLORS.muted} />}
                    label="Gate"
                    value={getGate(selected || {})}
                  />
                  <DetailRow
                    icon={<Clock3 size={16} color={COLORS.muted} />}
                    label="Time"
                    value={getTime(selected || {})}
                  />
                  <DetailRow
                    icon={<Activity size={16} color={COLORS.muted} />}
                    label="Message"
                    value={
                      selected?.message || getHumanActivity(selected || {})
                    }
                  />
                </View>

                <View style={styles.sheetActions}>
                  <Button
                    mode="contained"
                    buttonColor="#2563EB"
                    textColor="#FFFFFF"
                    style={styles.actionButton}
                    icon={() => <Copy size={16} color="#FFFFFF" />}
                    onPress={async () => {
                      const qr = getQR(selected || {});

                      if (!qr) {
                        Alert.alert(
                          "No QR",
                          "No QR code found for this activity.",
                        );
                        return;
                      }

                      await Clipboard.setStringAsync(qr);
                      Alert.alert("Copied", "QR copied successfully.");
                    }}
                  >
                    Copy QR
                  </Button>

                  <Button
                    mode="contained"
                    buttonColor="#334155"
                    textColor="#FFFFFF"
                    style={styles.actionButton}
                    onPress={() => setSelected(null)}
                  >
                    Close
                  </Button>
                </View>
              </ScrollView>
            </BlurView>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

function IconButton({ children, onPress, danger = false }) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(255,255,255,0.12)" }}
      style={[styles.iconButton, danger && styles.iconButtonDanger]}
    >
      {children}
    </Pressable>
  );
}

function MetricCard({ label, value, color, icon }) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricGlow, { backgroundColor: color }]} />

      <View style={styles.metricTop}>
        <Text style={styles.metricLabel}>{label}</Text>

        <View style={[styles.metricIcon, { backgroundColor: color }]}>
          {icon}
        </View>
      </View>

      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function ActivityCard({ item, onPress }) {
  const status = normalizeStatus(item.status);
  const color = getStatusColor(status);
  const direction = getDirection(item);
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(255,255,255,0.06)" }}
      style={styles.timelineRow}
    >
      <View style={styles.timelineRail}>
        <View style={[styles.timelineDot, { backgroundColor: color }]} />
        <View style={styles.timelineLine} />
      </View>

      <View style={styles.activityCard}>
        <View style={styles.activityTop}>
          <View style={[styles.avatar, { backgroundColor: color }]}>
            <Text style={styles.avatarText}>
              {getName(item).charAt(0).toUpperCase()}
            </Text>
          </View>

          <View style={styles.activityInfo}>
            <Text style={styles.activityName} numberOfLines={1}>
              {getName(item)}
            </Text>

            <Text style={styles.activitySub} numberOfLines={1}>
              {[getDesignation(item), getCompany(item)]
                .filter(Boolean)
                .join(" • ") || "Attendee"}
            </Text>
          </View>

          <View style={[styles.statusPill, { backgroundColor: `${color}22` }]}>
            {getStatusIcon(status, 13, color)}
            <Text style={[styles.statusText, { color }]}>{status}</Text>
          </View>
        </View>

        <Text style={styles.activityMessage} numberOfLines={2}>
          {getHumanActivity(item)}
        </Text>

        <View style={styles.activityMeta}>
          <View style={styles.metaItem}>
            {getDirectionIcon(direction, COLORS.muted, 15)}
            <Text style={styles.metaText}>{direction || "—"}</Text>
          </View>

          <View style={styles.metaItem}>
            <MapPin size={15} color={COLORS.muted} />
            <Text style={styles.metaText}>{getGate(item)}</Text>
          </View>

          <View style={styles.metaItem}>
            <Clock3 size={15} color={COLORS.muted} />
            <Text style={styles.metaText}>{safeText(getTime(item))}</Text>
          </View>
        </View>
        <View style={styles.scannerBox}>
          <View style={styles.scannerIcon}>
            <ShieldCheck size={15} color="#22C55E" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.scannerLabel}>Scanned By</Text>

            <Text style={styles.scannerName} numberOfLines={1}>
              {getScannerName(item)}
            </Text>

            <Text style={styles.scannerEmail} numberOfLines={1}>
              {getScannerEmail(item)}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function QuickCard({ label, value, icon }) {
  return (
    <View style={styles.quickCard}>
      <View style={styles.quickIcon}>{icon}</View>
      <Text style={styles.quickValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.quickLabel}>{label}</Text>
    </View>
  );
}

function DetailRow({ icon, label, value }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailLeft}>
        {icon}
        <Text style={styles.detailLabel}>{label}</Text>
      </View>

      <Text style={styles.detailValue}>{safeText(value)}</Text>
    </View>
  );
}

function EmptyState({ large = false }) {
  return (
    <View style={[styles.emptyState, large && styles.emptyLarge]}>
      <View style={styles.emptyIcon}>
        <ScanLine size={28} color={COLORS.muted} />
      </View>
      <Text style={styles.emptyTitle}>No activity yet</Text>
      <Text style={styles.emptyText}>Scans will appear here in real time.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },

  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },

  listContent: {
    paddingBottom: 150,
  },

  hero: {
    borderRadius: 34,
    overflow: "hidden",
    padding: 18,
    backgroundColor: "rgba(15,23,42,0.72)",
    marginBottom: 16,
  },

  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(34,197,94,0.13)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },

  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
    backgroundColor: COLORS.green,
    marginRight: 8,
  },

  liveText: {
    color: "#BBF7D0",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },

  actionRow: {
    flexDirection: "row",
    gap: 9,
  },

  iconButton: {
    width: 39,
    height: 39,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  iconButtonDanger: {
    backgroundColor: "rgba(239,68,68,0.88)",
  },

  heroTitleRow: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  title: {
    color: COLORS.white,
    fontSize: 31,
    fontWeight: "900",
    letterSpacing: -0.8,
  },

  subtitle: {
    color: COLORS.muted,
    marginTop: 5,
    fontSize: 13,
    fontWeight: "600",
  },

  sparkBox: {
    width: 44,
    height: 44,
    borderRadius: 18,
    backgroundColor: "rgba(139,92,246,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },

  primaryMetric: {
    marginTop: 22,
    padding: 18,
    borderRadius: 28,
    backgroundColor: "rgba(2,6,23,0.48)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  primaryLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },

  primaryValue: {
    color: COLORS.white,
    fontSize: 48,
    fontWeight: "900",
    letterSpacing: -1.8,
    marginTop: 2,
  },

  primaryHint: {
    color: COLORS.darkMuted,
    fontSize: 12,
    fontWeight: "700",
  },

  primaryIcon: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: COLORS.green,
    alignItems: "center",
    justifyContent: "center",
  },

  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 11,
    marginTop: 14,
  },

  metricCard: {
    width: "47.8%",
    borderRadius: 24,
    padding: 15,
    backgroundColor: "rgba(255,255,255,0.045)",
    overflow: "hidden",
  },

  metricGlow: {
    position: "absolute",
    right: -24,
    top: -24,
    width: 76,
    height: 76,
    borderRadius: 38,
    opacity: 0.16,
  },

  metricTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  metricLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "800",
  },

  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  metricValue: {
    color: COLORS.white,
    fontSize: 25,
    fontWeight: "900",
    marginTop: 12,
  },

  searchShell: {
    marginBottom: 12,
  },

  search: {
    height: 56,
    borderRadius: 24,
    backgroundColor: "rgba(15,23,42,0.82)",
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 0,
  },

  searchInput: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 14,
  },

  filterWrap: {
    gap: 9,
    paddingBottom: 18,
  },

  filterChip: {
    backgroundColor: "rgba(30,41,59,0.8)",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  filterChipActive: {
    backgroundColor: "#2563EB",
    borderColor: "rgba(37,99,235,0.9)",
  },

  filterText: {
    color: COLORS.muted,
    fontWeight: "900",
    fontSize: 11,
  },

  filterTextActive: {
    color: COLORS.white,
  },

  sectionHeader: {
    marginTop: 4,
    marginBottom: 11,
  },

  sectionTitle: {
    color: COLORS.white,
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: -0.3,
  },

  sectionSub: {
    color: COLORS.darkMuted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },

  gatePanel: {
    borderRadius: 26,
    backgroundColor: "rgba(15,23,42,0.68)",
    padding: 14,
    marginBottom: 20,
  },

  gateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 11,
  },

  gateLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  gateRank: {
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: "rgba(59,130,246,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },

  gateRankText: {
    color: COLORS.blue,
    fontWeight: "900",
  },

  gateName: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "800",
  },

  gateHint: {
    color: COLORS.darkMuted,
    fontSize: 11,
    marginTop: 2,
    fontWeight: "600",
  },

  gateCount: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "900",
  },

  timelineRow: {
    flexDirection: "row",
    marginBottom: 14,
  },

  timelineRail: {
    width: 24,
    alignItems: "center",
  },

  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 99,
    marginTop: 18,
  },

  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: "rgba(148,163,184,0.18)",
    marginTop: 6,
  },

  activityCard: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.78)",
    borderRadius: 26,
    padding: 15,
  },

  activityTop: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },

  avatar: {
    width: 50,
    height: 50,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },

  avatarText: {
    color: COLORS.white,
    fontSize: 21,
    fontWeight: "900",
  },

  activityInfo: {
    flex: 1,
  },

  activityName: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "900",
  },

  activitySub: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 4,
    fontWeight: "600",
  },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
  },

  statusText: {
    fontSize: 9,
    fontWeight: "900",
  },

  activityMessage: {
    color: COLORS.text,
    marginTop: 12,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
  },

  activityMeta: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.045)",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  metaText: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "800",
  },

  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 22,
  },

  emptyLarge: {
    paddingTop: 70,
  },

  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  emptyTitle: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "900",
  },

  emptyText: {
    color: COLORS.muted,
    marginTop: 5,
    fontSize: 12,
    fontWeight: "600",
  },

  sheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.55)",
  },

  sheetOverlay: {
    flex: 1,
  },

  sheet: {
    maxHeight: "90%",
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    overflow: "hidden",
    backgroundColor: "rgba(15,23,42,0.98)",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  sheetContent: {
    paddingHorizontal: 20,
    paddingBottom: 34,
  },

  sheetHandle: {
    width: 52,
    height: 5,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.23)",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 18,
  },

  sheetTop: {
    alignItems: "center",
  },

  sheetAvatar: {
    width: 92,
    height: 92,
    borderRadius: 34,
    justifyContent: "center",
    alignItems: "center",
  },

  sheetAvatarText: {
    color: COLORS.white,
    fontSize: 38,
    fontWeight: "900",
  },

  closeBtn: {
    position: "absolute",
    right: 0,
    top: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  statusLarge: {
    marginTop: 18,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },

  statusLargeText: {
    fontSize: 11,
    fontWeight: "900",
  },

  sheetName: {
    color: COLORS.white,
    fontSize: 27,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 15,
    letterSpacing: -0.4,
  },

  sheetSub: {
    color: COLORS.muted,
    textAlign: "center",
    marginTop: 5,
    fontSize: 13,
    fontWeight: "700",
  },

  sheetMessage: {
    color: COLORS.text,
    textAlign: "center",
    marginTop: 15,
    lineHeight: 22,
    fontSize: 14,
    fontWeight: "600",
  },

  quickGrid: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },

  quickCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.045)",
    borderRadius: 22,
    padding: 15,
    alignItems: "center",
  },

  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: "rgba(59,130,246,0.75)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },

  quickValue: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "900",
  },

  quickLabel: {
    color: COLORS.muted,
    marginTop: 4,
    fontSize: 11,
    fontWeight: "700",
  },

  detailBox: {
    marginTop: 18,
    backgroundColor: "rgba(2,6,23,0.45)",
    borderRadius: 24,
    paddingHorizontal: 14,
  },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.045)",
  },

  detailLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    flex: 1,
  },

  detailLabel: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "700",
  },

  detailValue: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "900",
    maxWidth: "55%",
    textAlign: "right",
  },

  sheetActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 22,
  },

  actionButton: {
    flex: 1,
    borderRadius: 18,
  },
  scannerBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(34,197,94,0.08)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.16)",
  },

  scannerIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(34,197,94,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  scannerLabel: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  scannerName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 2,
  },

  scannerEmail: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 1,
  },
});
