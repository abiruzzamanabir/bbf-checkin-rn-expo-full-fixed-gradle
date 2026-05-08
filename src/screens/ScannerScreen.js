import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Modal,
  FlatList,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { fetchEventStats } from "../api/stats";
import { api } from "../api/client";
import { fetchEvents } from "../api/events";
import { fetchGates } from "../api/gates";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Network from "expo-network";
import * as Device from "expo-device";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";

import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Searchbar, ActivityIndicator, Button } from "react-native-paper";

import {
  Camera,
  Flashlight,
  FlashlightOff,
  Search,
  Plus,
  Minus,
  X,
  Wifi,
  WifiOff,
  Users,
  LogIn,
  LogOut,
  MapPin,
  Clock3,
  QrCode,
  ShieldCheck,
  AlertTriangle,
  CloudOff,
  ArrowDownCircle,
  ArrowUpCircle,
  ScanLine,
  Building2,
  Briefcase,
  Zap,
  BadgeCheck,
  Radio,
} from "lucide-react-native";

import { submitScan } from "../api/scan";
import { searchTickets } from "../api/tickets";

import {
  enqueueOfflineScan,
  pushHistory,
  getOfflineQueue,
  setOfflineQueue,
} from "../storage/scans";

import {
  getSettings,
  setSettings as persistSettings,
} from "../storage/settings";

import { useRole } from "../context/RoleContext";
import { useFocusEffect } from "@react-navigation/native";

function nowLabel() {
  return new Date().toLocaleTimeString();
}

function getFlashColor(status) {
  if (status === "SUCCESS") return "#22C55E";
  if (status === "DUPLICATE") return "#F59E0B";
  if (status === "INVALID") return "#EF4444";
  if (status === "OFFLINE") return "#3B82F6";
  return "#FFFFFF";
}

function getBgColor(status) {
  if (status === "SUCCESS") return "#052E1F";
  if (status === "DUPLICATE") return "#3B2A0A";
  if (status === "INVALID") return "#3F1D1D";
  if (status === "OFFLINE") return "#102A43";
  return "#0B1220";
}

function detectStatus(message = "") {
  const m = String(message).toLowerCase();

  if (
    m.includes("already") ||
    m.includes("duplicate") ||
    m.includes("processed")
  ) {
    return "DUPLICATE";
  }

  if (
    m.includes("invalid") ||
    m.includes("cannot") ||
    m.includes("not allowed") ||
    m.includes("not marked") ||
    m.includes("denied") ||
    m.includes("failed") ||
    m.includes("forbidden")
  ) {
    return "INVALID";
  }

  return "SUCCESS";
}

function isOfflineLikeError(error) {
  if (!error) return false;
  if (error?.message === "offline") return true;
  if (error?.response) return false;

  const msg = String(error?.message || "").toLowerCase();

  return (
    msg.includes("network error") ||
    msg.includes("request failed") ||
    msg.includes("timeout") ||
    msg.includes("offline") ||
    msg.includes("internet")
  );
}

function getAttendeeName(attendee, fallback = "Unknown Attendee") {
  return (
    attendee?.full_name ||
    attendee?.name ||
    attendee?.attendee_name ||
    attendee?.display_name ||
    `${attendee?.first_name || ""} ${attendee?.last_name || ""}`.trim() ||
    fallback
  );
}

function getAttendeeCompany(attendee) {
  return (
    attendee?.company ||
    attendee?.organization ||
    attendee?.organisation ||
    attendee?.company_name ||
    ""
  );
}

function getAttendeeDesignation(attendee) {
  return (
    attendee?.designation ||
    attendee?.title ||
    attendee?.job_title ||
    attendee?.position ||
    attendee?.role ||
    ""
  );
}

function ResultIcon({ status }) {
  if (status === "SUCCESS") return <ShieldCheck size={32} color="#22C55E" />;
  if (status === "DUPLICATE")
    return <AlertTriangle size={32} color="#F59E0B" />;
  if (status === "OFFLINE") return <CloudOff size={32} color="#3B82F6" />;
  return <X size={32} color="#EF4444" />;
}

function statusTitle(card) {
  if (!card) return "";

  const firstName = String(card.name || "Guest")
    .split(" ")[0]
    .trim();

  if (card.status === "SUCCESS") {
    return card.direction === "IN"
      ? `${firstName} Entered`
      : `${firstName} Exited`;
  }

  if (card.status === "DUPLICATE") {
    return card.direction === "IN"
      ? `${firstName} Already Inside`
      : `${firstName} Already Exited`;
  }

  if (card.status === "INVALID") return `${firstName} Could Not Enter`;
  if (card.status === "OFFLINE") return `${firstName} Saved Offline`;

  return "Scan Recorded";
}

function getHumanMessage(card) {
  if (!card) return "";

  if (card.status === "SUCCESS") {
    return card.direction === "IN"
      ? "Successfully checked into the venue."
      : "Successfully checked out from the venue.";
  }

  if (card.status === "DUPLICATE") {
    return card.direction === "IN"
      ? "This attendee has already entered."
      : "This attendee has already exited.";
  }

  if (card.status === "INVALID") {
    return (
      card.message || "This attendee is not permitted to access the venue."
    );
  }

  if (card.status === "OFFLINE") {
    return "Saved locally. It will sync automatically when internet returns.";
  }

  return card.message || "";
}

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();

  const { role } = useRole();
  const insets = useSafeAreaInsets();
  const safeBottom = Platform.OS === "ios" ? 118 : 100;
  const [settings, setSettingsState] = useState({
    event: null,
    gate: null,
    direction: "IN",
  });

  const [online, setOnline] = useState(true);
  const [lastCard, setLastCard] = useState(null);
  const [scanLocked, setScanLocked] = useState(false);
  const [flashOn, setFlashOn] = useState(false);

  const [entryCount, setEntryCount] = useState(0);
  const [exitCount, setExitCount] = useState(0);
  const [insideCount, setInsideCount] = useState(0);
  const [liveStatsLoading, setLiveStatsLoading] = useState(false);

  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [scanReady, setScanReady] = useState(true);
  const [zoom, setZoom] = useState(0.2);

  const [manualOpen, setManualOpen] = useState(false);
  const [manualQ, setManualQ] = useState("");
  const [manualItems, setManualItems] = useState([]);
  const [manualLoading, setManualLoading] = useState(false);

  const [gates, setGates] = useState([]);
  const [gateModal, setGateModal] = useState(false);

  const direction = settings.direction || "IN";

  const processingRef = useRef(false);
  const attendeeCacheRef = useRef({});
  const qrScanMemoryRef = useRef(new Map());
  const syncRunningRef = useRef(false);
  const hideCardTimerRef = useRef(null);

  const flashAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const inSoundRef = useRef(null);
  const outSoundRef = useRef(null);
  const failSoundRef = useRef(null);
  async function syncLiveSettings() {
    try {
      /* ---------------- */
      /* LOCAL SETTINGS   */
      /* ---------------- */

      const local = await getSettings();

      /* ---------------- */
      /* EVENTS           */
      /* ---------------- */

      const events = await fetchEvents();

      const cleanEvents = Array.isArray(events) ? events : [];

      let validEvent = null;

      if (local?.event?.id) {
        validEvent =
          cleanEvents.find((e) => Number(e.id) === Number(local.event.id)) ||
          null;
      }

      if (!validEvent) {
        validEvent = cleanEvents?.[0] || null;
      }

      /* ---------------- */
      /* GATES            */
      /* ---------------- */

      const gates = await fetchGates(validEvent?.slug);

      const cleanGates = Array.isArray(gates?.gates)
        ? gates.gates
        : Array.isArray(gates)
          ? gates
          : [];

      let validGate = null;

      if (local?.gate?.id) {
        validGate =
          cleanGates.find((g) => Number(g.id) === Number(local.gate.id)) ||
          null;
      }

      if (!validGate) {
        if (validGate && !Boolean(validGate.is_active)) {
          console.log("DISABLED GATE DETECTED → REMOVING");

          if (validGate && !Boolean(validGate.is_active)) {
            console.log("DISABLED GATE DETECTED → REMOVING");

            validGate = cleanGates.find((g) => Boolean(g.is_active)) || null;
          }
        }
      }

      /* ---------------- */
      /* FINAL SETTINGS   */
      /* ---------------- */

      const updated = {
        ...local,
        event: validEvent,
        gate: validGate,
      };

      /* AUTO DIRECTION */

      const code = String(validGate?.code || "").toUpperCase();

      if (code.includes("OUT")) {
        updated.direction = "OUT";
      } else if (code.includes("IN")) {
        updated.direction = "IN";
      }

      /* SAVE */

      await persistSettings(updated);

      /* UPDATE UI */

      setSettingsState((prev) => {
        const changed = JSON.stringify(prev) !== JSON.stringify(updated);

        if (changed) {
          console.log("LIVE SETTINGS UPDATED:", updated);

          return updated;
        }

        return prev;
      });
    } catch (e) {
      console.log("SYNC LIVE SETTINGS ERROR:", e);
    }
  }
  useEffect(() => {
    let mounted = true;

    async function loadSounds() {
      try {
        const inSound = await Audio.Sound.createAsync(
          require("../../assets/sounds/in.wav"),
        );

        const outSound = await Audio.Sound.createAsync(
          require("../../assets/sounds/out.wav"),
        );

        const failSound = await Audio.Sound.createAsync(
          require("../../assets/sounds/fail.wav"),
        );

        if (!mounted) return;

        inSoundRef.current = inSound.sound;
        outSoundRef.current = outSound.sound;
        failSoundRef.current = failSound.sound;
      } catch {}
    }

    loadSounds();

    return () => {
      mounted = false;
      inSoundRef.current?.unloadAsync?.();
      outSoundRef.current?.unloadAsync?.();
      failSoundRef.current?.unloadAsync?.();
    };
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 1300,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 1300,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;

      async function loadScannerSettings() {
        try {
          /* ---------------- */
          /* LOCAL SETTINGS   */
          /* ---------------- */

          const local = await getSettings();

          /* ---------------- */
          /* EVENTS           */
          /* ---------------- */

          const events = await fetchEvents();

          const cleanEvents = Array.isArray(events) ? events : [];

          let validEvent = null;

          if (local?.event?.id) {
            validEvent =
              cleanEvents.find(
                (e) => Number(e.id) === Number(local.event.id),
              ) || null;
          }

          if (!validEvent) {
            validEvent = cleanEvents?.[0] || null;
          }

          /* ---------------- */
          /* GATES            */
          /* ---------------- */

          const gates = await fetchGates(validEvent?.slug);

          const cleanGates = Array.isArray(gates?.gates)
            ? gates.gates
            : Array.isArray(gates)
              ? gates
              : [];
          let validGate = null;

          if (local?.gate?.id) {
            validGate =
              cleanGates.find((g) => Number(g.id) === Number(local.gate.id)) ||
              null;
          }

          if (!validGate) {
            validGate = cleanGates.find((g) => Boolean(g.is_active)) || null;
          }

          /* ---------------- */
          /* FINAL SETTINGS   */
          /* ---------------- */

          const updated = {
            ...local,
            event: validEvent,
            gate: validGate,
          };

          /* AUTO DIRECTION */

          const code = String(validGate?.code || "").toUpperCase();

          if (code.includes("OUT")) {
            updated.direction = "OUT";
          } else if (code.includes("IN")) {
            updated.direction = "IN";
          }

          /* SAVE */

          await persistSettings(updated);

          /* UPDATE UI */

          if (mounted) {
            setSettingsState(updated);
          }

          console.log("SCANNER LIVE SETTINGS:", updated);
        } catch (e) {
          console.log("SCANNER SETTINGS ERROR:", e);
        }
      }

      loadScannerSettings();

      return () => {
        mounted = false;
      };
    }, []),
  );

  useEffect(() => {
    if (!lastCard) return;

    cardAnim.setValue(0);

    Animated.spring(cardAnim, {
      toValue: 1,
      friction: 8,
      tension: 90,
      useNativeDriver: true,
    }).start();

    if (lastCard.status === "INVALID") {
      Animated.sequence([
        Animated.timing(shakeAnim, {
          toValue: 10,
          duration: 40,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: -10,
          duration: 40,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 6,
          duration: 40,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 0,
          duration: 40,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [lastCard]);

  useEffect(() => {
    const check = async () => {
      try {
        const st = await Network.getNetworkStateAsync();
        const connected = !!st.isConnected;

        setOnline(connected);

        if (connected) {
          await syncOfflineQueue();
        } else {
          const q = await getOfflineQueue();
          setPendingSyncCount(Array.isArray(q) ? q.length : 0);
        }
      } catch {}
    };

    check();

    const id = setInterval(check, 3000);

    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function liveRefresh() {
      try {
        /* ---------------- */
        /* SETTINGS SYNC    */
        /* ---------------- */

        await syncLiveSettings();

        /* ---------------- */
        /* LIVE STATS       */
        /* ---------------- */

        if (settings?.event?.slug) {
          await fetchLiveStats();
        }

        /* ---------------- */
        /* GATES            */
        /* ---------------- */

        if (settings?.event?.slug) {
          await loadGates();
        }
      } catch (e) {
        console.log("LIVE REFRESH ERROR:", e);
      }
    }

    /* INITIAL */

    liveRefresh();

    /* AUTO UPDATE */

    const id = setInterval(() => {
      if (mounted) {
        liveRefresh();
      }
    }, 5000);

    return () => {
      mounted = false;

      clearInterval(id);
    };
  }, [settings?.event?.slug]);

  async function loadGates() {
    try {
      const res = await api.get("/gates", {
        params: {
          event_slug: settings?.event?.slug,
        },
      });

      console.log("GATES RESPONSE:", JSON.stringify(res.data, null, 2));

      /* ---------------- */
      /* NORMALIZE        */
      /* ---------------- */

      const raw = res?.data?.gates || res?.data?.data || res?.data || [];

      const clean = Array.isArray(raw) ? raw : [];

      /* ---------------- */
      /* ACTIVE ONLY      */
      /* ---------------- */

      const activeGates = clean.filter((g) => Boolean(g.is_active));

      setGates(activeGates);

      /* ---------------- */
      /* CURRENT GATE     */
      /* ---------------- */

      const currentGate = settings?.gate;

      /* ---------------- */
      /* IF CURRENT GATE  */
      /* REMOVED/DISABLED */
      /* ---------------- */

      if (
        currentGate &&
        !activeGates.find((g) => Number(g.id) === Number(currentGate.id))
      ) {
        console.log("CURRENT GATE DISABLED → AUTO SWITCH");

        const fallback = activeGates?.[0] || null;

        const updated = {
          ...settings,
          gate: fallback,
        };

        /* AUTO DIRECTION */

        const code = String(fallback?.code || "").toUpperCase();

        if (code.includes("OUT")) {
          updated.direction = "OUT";
        } else if (code.includes("IN")) {
          updated.direction = "IN";
        }

        await persistSettings(updated);

        setSettingsState(updated);
      }
    } catch (e) {
      console.log("GATE LOAD ERROR:", e);
    }
  }

  async function syncOfflineQueue() {
    if (syncRunningRef.current) return;

    syncRunningRef.current = true;
    setIsSyncing(true);

    try {
      const q = await getOfflineQueue();

      if (!q.length) {
        setPendingSyncCount(0);
        return;
      }

      const remaining = [];

      for (const p of q) {
        try {
          await submitScan(p);
        } catch (error) {
          if (error?.response?.data) continue;
          remaining.push(p);
        }
      }

      await setOfflineQueue(remaining);
      setPendingSyncCount(remaining.length);
    } catch {
    } finally {
      syncRunningRef.current = false;
      setIsSyncing(false);
    }
  }

  async function selectGate(gate) {
    try {
      console.log("SELECTED GATE:", gate);

      const updatedSettings = {
        ...settings,
        gate: {
          id: gate?.id,
          name: gate?.name,
          code: gate?.code,
          is_active: gate?.is_active,
        },
      };

      /* AUTO DIRECTION */

      const code = String(gate?.code || "").toUpperCase();

      if (code.includes("OUT")) {
        updatedSettings.direction = "OUT";
      } else if (code.includes("IN")) {
        updatedSettings.direction = "IN";
      }

      /* UPDATE UI */

      setSettingsState(updatedSettings);

      /* SAVE */

      await persistSettings(updatedSettings);

      /* CLOSE */

      setGateModal(false);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      console.log("UPDATED SETTINGS:", updatedSettings);
    } catch (e) {
      console.log("GATE SWITCH ERROR:", e);
    }
  }

  async function playForDirection(ok, directionValue, status) {
    try {
      if (status === "DUPLICATE" || status === "INVALID") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        return failSoundRef.current?.replayAsync?.();
      }

      if (!ok) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return failSoundRef.current?.replayAsync?.();
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (directionValue === "IN") {
        return inSoundRef.current?.replayAsync?.();
      }
      return outSoundRef.current?.replayAsync?.();
    } catch {}
  }

  function triggerFlash() {
    flashAnim.setValue(0);

    Animated.sequence([
      Animated.timing(flashAnim, {
        toValue: 0.72,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(flashAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }

  function showCard(card) {
    setLastCard(card);
    triggerFlash();

    if (hideCardTimerRef.current) {
      clearTimeout(hideCardTimerRef.current);
    }

    hideCardTimerRef.current = setTimeout(() => {
      setLastCard((prev) => (prev?.id === card.id ? null : prev));
    }, 5000);
  }

  async function makeCard({
    name,
    company,
    designation,
    message,
    status,
    directionValue,
    qr,
    gate,
    vip = false,
  }) {
    const now = Date.now();

    const card = {
      id: now + Math.floor(Math.random() * 1000),
      ts: now,
      name: name || "Unknown Attendee",
      company: company || "",
      designation: designation || "",
      message: message || "Recorded",
      direction: directionValue,
      status,
      qr_code: qr || "",
      gate: gate || "Main Gate",
      time_label: nowLabel(),
      vip,
    };

    await pushHistory(card);
    showCard(card);

    return card;
  }

  async function onScanPayload({ qr_code }) {
    if (!qr_code) return;

    if (!settings?.event?.slug || !settings?.gate?.id) {
      await makeCard({
        name: "Configuration Missing",
        company: "",
        designation: "",
        message: "Event or Gate not selected",
        status: "INVALID",
        directionValue: direction,
        qr: qr_code,
        gate: "N/A",
      });

      return;
    }

    const payload = {
      qr_code,
      direction,
      event_slug: settings?.event?.slug,
      gate_id: settings?.gate?.id,
      device_uuid: Device.modelId || Device.deviceName || "device",
    };

    try {
      if (!online) throw new Error("offline");

      const res = await submitScan(payload);

      const message = res?.message || "Recorded";
      const status = detectStatus(message);

      if (res?.attendee) {
        attendeeCacheRef.current[qr_code] = res.attendee;
      }

      const attendee =
        res?.attendee ||
        res?.ticket?.attendee ||
        attendeeCacheRef.current[qr_code] ||
        null;

      const isVIP = !!attendee?.vip;

      await makeCard({
        name: getAttendeeName(attendee),
        company: getAttendeeCompany(attendee),
        designation: getAttendeeDesignation(attendee),
        message,
        status,
        directionValue: direction,
        qr: qr_code,
        gate: settings?.gate?.name || settings?.gate?.code || "Main Gate",
        vip: isVIP,
      });

      await playForDirection(status === "SUCCESS", direction, status);
      await fetchLiveStats();
    } catch (error) {
      if (error?.response?.data) {
        const apiData = error.response.data;
        const message = apiData?.message || "Scan failed";
        const status = detectStatus(message);

        if (apiData?.attendee) {
          attendeeCacheRef.current[qr_code] = apiData.attendee;
        }

        const attendee =
          apiData?.attendee || attendeeCacheRef.current[qr_code] || null;

        await makeCard({
          name: getAttendeeName(attendee),
          company: getAttendeeCompany(attendee),
          designation: getAttendeeDesignation(attendee),
          message,
          status,
          directionValue: direction,
          qr: qr_code,
          gate: settings?.gate?.name || settings?.gate?.code || "Main Gate",
          vip: !!attendee?.vip,
        });

        await playForDirection(false, direction, status);
        await fetchLiveStats();
        return;
      }

      if (isOfflineLikeError(error)) {
        await enqueueOfflineScan(payload);

        const q = await getOfflineQueue();
        setPendingSyncCount(Array.isArray(q) ? q.length : 0);

        await makeCard({
          name: "Offline Scan",
          company: "",
          designation: "",
          message: "Saved locally. Will sync when internet returns.",
          status: "OFFLINE",
          directionValue: direction,
          qr: qr_code,
          gate: settings?.gate?.name || settings?.gate?.code || "Main Gate",
        });

        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Warning,
        );

        await playForDirection(true, direction, "OFFLINE");
        return;
      }

      await makeCard({
        name: "Scan Failed",
        company: "",
        designation: "",
        message: "Unexpected error while processing scan.",
        status: "INVALID",
        directionValue: direction,
        qr: qr_code,
        gate: settings?.gate?.name || settings?.gate?.code || "Main Gate",
      });

      await playForDirection(false, direction, "INVALID");
      await fetchLiveStats();
    }
  }

  const onBarcodeScanned = async ({ data }) => {
    const qr_code = String(data || "").trim();

    if (!qr_code) return;
    if (scanLocked) return;
    if (processingRef.current) return;

    const now = Date.now();
    const lastSeen = qrScanMemoryRef.current.get(qr_code);

    if (lastSeen && now - lastSeen < 2500) return;

    qrScanMemoryRef.current.set(qr_code, now);

    processingRef.current = true;
    setScanLocked(true);
    setScanReady(false);

    try {
      await onScanPayload({ qr_code });
    } finally {
      processingRef.current = false;

      setTimeout(() => {
        setScanLocked(false);
        setScanReady(true);
      }, 750);
    }
  };

  async function runTicketSearch(q) {
    const event_slug = settings?.event?.slug;

    if (!event_slug || q.trim().length < 2) return;

    try {
      setManualLoading(true);

      const data = await searchTickets({
        event_slug,
        q,
      });

      setManualItems(
        data?.items || data?.data || data?.attendees || data?.results || [],
      );
    } catch {
      setManualItems([]);
    } finally {
      setManualLoading(false);
    }
  }

  async function selectManualAttendee(item) {
    const qr_code = item.qr_code || item?.attendee?.qr_code;

    if (!qr_code) return;

    setManualOpen(false);
    setManualQ("");
    setManualItems([]);

    await onScanPayload({ qr_code });
  }

  async function fetchLiveStats() {
    try {
      if (!settings?.event?.slug) return;

      setLiveStatsLoading(true);

      const stats = await fetchEventStats(settings.event.slug);

      setEntryCount(Number(stats.total_entries || 0));

      setExitCount(Number(stats.total_exits || 0));

      setInsideCount(Number(stats.current_inside || 0));
    } catch (e) {
      // console.log("LIVE STATS ERROR:", e?.message);
    } finally {
      setLiveStatsLoading(false);
    }
  }

  async function setDirection(next) {
    const updated = { ...settings, direction: next };

    setSettingsState(updated);
    await persistSettings(updated);
  }

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <LinearGradient
        colors={["#020617", "#07111F", "#0F172A"]}
        style={styles.center}
      >
        <View style={styles.permissionIcon}>
          <Camera size={54} color="#FFFFFF" />
        </View>

        <Text style={styles.permissionTitle}>Camera Access Required</Text>

        <Text style={styles.permissionSub}>
          Please allow camera permission to scan event QR codes.
        </Text>

        <Button
          mode="contained"
          buttonColor="#2563EB"
          textColor="#FFFFFF"
          onPress={requestPermission}
          style={styles.permissionButton}
        >
          Grant Permission
        </Button>
      </LinearGradient>
    );
  }

  const scanLineTranslate = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-112, 112],
  });

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={flashOn}
        zoom={zoom}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanLocked ? undefined : onBarcodeScanned}
      />

      <LinearGradient
        colors={["rgba(2,6,23,0.96)", "rgba(2,6,23,0.28)", "rgba(2,6,23,0.98)"]}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.flashOverlay,
          {
            opacity: flashAnim,
            backgroundColor: getFlashColor(lastCard?.status),
          },
        ]}
      />

      <SafeAreaView style={styles.safe}>
        <View style={styles.headerShell}>
          <BlurView intensity={45} tint="dark" style={styles.headerCard}>
            <View style={styles.headerTop}>
              <View style={styles.brandIcon}>
                <ScanLine size={23} color="#FFFFFF" />
              </View>

              <View style={styles.headerTextBox}>
                <Text style={styles.headerTitle}>BBF Scanner</Text>
                <Text style={styles.headerSub} numberOfLines={1}>
                  {settings?.event?.name || "No Event Selected"}
                </Text>
              </View>

              <View style={online ? styles.netPillOn : styles.netPillOff}>
                {online ? (
                  <Wifi size={13} color="#BBF7D0" />
                ) : (
                  <WifiOff size={13} color="#FECACA" />
                )}
                <Text style={styles.netText}>
                  {online ? "ONLINE" : "OFFLINE"}
                </Text>
              </View>
            </View>

            <View style={styles.headerBottom}>
              <Pressable onPress={() => setGateModal(true)} style={{ flex: 1 }}>
                <InfoChip
                  icon={<MapPin size={13} color="#93C5FD" />}
                  text={
                    settings?.gate && Boolean(settings?.gate?.is_active)
                      ? settings?.gate?.name
                        ? `${settings.gate.name}`
                        : `${settings.gate.code}`
                      : "No Active Gate"
                  }
                />
              </Pressable>

              <InfoChip
                icon={<BadgeCheck size={13} color="#C4B5FD" />}
                text={role || "OPERATOR"}
              />

              <InfoChip
                icon={<Radio size={13} color="#FDE68A" />}
                text={scanReady ? "Ready" : "Processing"}
              />
            </View>
          </BlurView>
        </View>

        <View style={styles.metricDock}>
          <MetricCard
            icon={<LogIn size={18} color="#22C55E" />}
            label="Entries"
            value={entryCount}
          />

          <MetricCard
            icon={<LogOut size={18} color="#F97316" />}
            label="Exits"
            value={exitCount}
          />

          <MetricCard
            icon={<Users size={18} color="#60A5FA" />}
            label="Inside"
            value={insideCount}
          />
        </View>

        <View style={styles.segmentWrap}>
          <BlurView intensity={34} tint="dark" style={styles.segment}>
            <Pressable
              onPress={() => setDirection("IN")}
              style={[
                styles.segmentBtn,
                direction === "IN" && styles.segmentActiveIn,
              ]}
            >
              <ArrowDownCircle size={18} color="#FFFFFF" />
              <Text
                style={[
                  styles.segmentText,
                  direction === "IN" && styles.segmentTextActive,
                ]}
              >
                CHECK IN
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setDirection("OUT")}
              style={[
                styles.segmentBtn,
                direction === "OUT" && styles.segmentActiveOut,
              ]}
            >
              <ArrowUpCircle size={18} color="#FFFFFF" />
              <Text
                style={[
                  styles.segmentText,
                  direction === "OUT" && styles.segmentTextActive,
                ]}
              >
                CHECK OUT
              </Text>
            </Pressable>
          </BlurView>
        </View>

        <View style={styles.scannerArea}>
          <BlurView intensity={36} tint="dark" style={styles.readyPill}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: scanReady ? "#22C55E" : "#F97316",
                },
              ]}
            />
            <Text style={styles.readyText}>
              {scanReady ? "READY TO SCAN" : "PROCESSING"}
            </Text>
          </BlurView>

          <Animated.View
            pointerEvents="none"
            style={[
              styles.pulseRing,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />

          <View style={styles.scanFrame}>
            <View style={styles.scanGlass} />

            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />

            <Animated.View
              style={[
                styles.scanBeam,
                {
                  transform: [{ translateY: scanLineTranslate }],
                },
              ]}
            />

            {!scanReady && (
              <BlurView intensity={42} tint="dark" style={styles.processingBox}>
                <ActivityIndicator animating color="#22C55E" />
                <Text style={styles.processingText}>Processing scan...</Text>
              </BlurView>
            )}
          </View>

          <Text style={styles.scanHint}>Place QR inside the frame</Text>
        </View>

        <View style={styles.bottomActions}>
          <View style={styles.actionRow}>
            <ControlButton
              active={flashOn}
              label={flashOn ? "Torch On" : "Torch"}
              onPress={() => setFlashOn((prev) => !prev)}
              icon={
                flashOn ? (
                  <Flashlight size={19} color="#FFFFFF" />
                ) : (
                  <FlashlightOff size={19} color="#FFFFFF" />
                )
              }
            />

            <ControlButton
              label="Search"
              onPress={() => setManualOpen(true)}
              icon={<Search size={19} color="#FFFFFF" />}
            />

            <ControlButton
              label="+ Zoom"
              onPress={() =>
                setZoom((z) => Math.min(1, Number((z + 0.1).toFixed(1))))
              }
              icon={<Plus size={19} color="#FFFFFF" />}
            />

            <ControlButton
              label="- Zoom"
              onPress={() =>
                setZoom((z) => Math.max(0, Number((z - 0.1).toFixed(1))))
              }
              icon={<Minus size={19} color="#FFFFFF" />}
            />
          </View>

          <Text style={styles.zoomText}>Zoom {Math.round(zoom * 100)}%</Text>
        </View>

        {pendingSyncCount > 0 || isSyncing ? (
          <BlurView intensity={36} tint="dark" style={styles.syncToast}>
            <CloudOff size={15} color="#93C5FD" />
            <Text style={styles.syncToastText}>
              {pendingSyncCount > 0
                ? `${pendingSyncCount} offline scan pending`
                : "Syncing offline scans..."}
            </Text>
          </BlurView>
        ) : null}

        {lastCard && (
          <Animated.View
            style={[
              styles.resultHero,
              {
                bottom: safeBottom + 18,
                borderColor: getFlashColor(lastCard.status),
                transform: [
                  { translateX: shakeAnim },
                  {
                    translateY: cardAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [120, 0],
                    }),
                  },
                  {
                    scale: cardAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.95, 1],
                    }),
                  },
                ],
                opacity: cardAnim,
              },
            ]}
          >
            <LinearGradient
              colors={[
                `${getFlashColor(lastCard.status)}33`,
                getBgColor(lastCard.status),
                "rgba(2,6,23,0.98)",
              ]}
              style={styles.resultGradient}
            >
              <View style={styles.resultTopLine}>
                <View
                  style={[
                    styles.resultIconWrap,
                    {
                      backgroundColor: `${getFlashColor(lastCard.status)}22`,
                    },
                  ]}
                >
                  <ResultIcon status={lastCard.status} />
                </View>

                <View
                  style={[
                    styles.resultBadge,
                    {
                      backgroundColor: `${getFlashColor(lastCard.status)}22`,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.resultBadgeText,
                      { color: getFlashColor(lastCard.status) },
                    ]}
                  >
                    {lastCard.status}
                  </Text>
                </View>
              </View>

              <Text style={styles.resultTitle}>{statusTitle(lastCard)}</Text>

              <Text style={styles.resultPerson}>{lastCard.name}</Text>

              {!!lastCard.designation && (
                <View style={styles.resultLine}>
                  <Briefcase size={13} color="#94A3B8" />
                  <Text style={styles.resultDesignation} numberOfLines={1}>
                    {lastCard.designation}
                  </Text>
                </View>
              )}

              {!!lastCard.company && (
                <View style={styles.resultLine}>
                  <Building2 size={13} color="#CBD5E1" />
                  <Text style={styles.resultCompany} numberOfLines={1}>
                    {lastCard.company}
                  </Text>
                </View>
              )}

              <Text style={styles.resultMessageHuman}>
                {getHumanMessage(lastCard)}
              </Text>

              <View style={styles.resultMetaGrid}>
                <View style={styles.resultMetaItem}>
                  <MapPin size={14} color="#94A3B8" />
                  <Text style={styles.resultMetaText} numberOfLines={1}>
                    {lastCard.gate}
                  </Text>
                </View>

                <View style={styles.resultMetaItem}>
                  <Clock3 size={14} color="#94A3B8" />
                  <Text style={styles.resultMetaText}>
                    {lastCard.time_label}
                  </Text>
                </View>
              </View>

              <View style={styles.qrLine}>
                <QrCode size={14} color="#93C5FD" />
                <Text style={styles.resultQR} numberOfLines={1}>
                  {lastCard.qr_code}
                </Text>
              </View>
            </LinearGradient>
          </Animated.View>
        )}
      </SafeAreaView>

      <Modal visible={manualOpen} animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <SafeAreaView style={styles.manualContainer}>
            <LinearGradient
              colors={["#020617", "#08111F", "#0F172A"]}
              style={StyleSheet.absoluteFill}
            />

            <View style={styles.manualHeader}>
              <View style={styles.manualIcon}>
                <Search size={24} color="#FFFFFF" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.manualTitle}>Search Attendee</Text>
                <Text style={styles.manualSubtitle}>
                  Search by name, phone, email, or QR code
                </Text>
              </View>

              <Pressable
                style={styles.closeButton}
                onPress={() => {
                  setManualOpen(false);
                  setManualQ("");
                  setManualItems([]);
                }}
              >
                <X size={20} color="#FFFFFF" />
              </Pressable>
            </View>

            <Searchbar
              placeholder="Type at least 2 characters"
              placeholderTextColor="#7F8EA8"
              value={manualQ}
              onChangeText={(t) => {
                setManualQ(t);

                if (t.trim().length >= 2) {
                  runTicketSearch(t);
                } else {
                  setManualItems([]);
                }
              }}
              autoFocus
              style={styles.manualSearchbar}
              inputStyle={styles.manualSearchInput}
              icon={() => <Search size={20} color="#94A3B8" />}
            />

            {manualLoading && (
              <View style={styles.manualLoading}>
                <ActivityIndicator animating color="#22C55E" />
                <Text style={styles.manualLoadingText}>Searching...</Text>
              </View>
            )}

            {!manualLoading &&
              manualQ.length >= 2 &&
              manualItems.length === 0 && (
                <View style={styles.emptyBox}>
                  <Search size={34} color="#64748B" />
                  <Text style={styles.emptyTitle}>No attendee found</Text>
                  <Text style={styles.emptySub}>Try another keyword.</Text>
                </View>
              )}

            <FlatList
              data={manualItems}
              keyExtractor={(item, index) =>
                String(item.ticket_id || item.id || item.qr_code || index)
              }
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 24 }}
              renderItem={({ item }) => {
                const attendee = item.attendee || item;

                const name = getAttendeeName(attendee);
                const company = getAttendeeCompany(attendee) || "No company";
                const designation = getAttendeeDesignation(attendee);
                const qr = item.qr_code || attendee.qr_code || "N/A";

                return (
                  <Pressable
                    style={styles.manualItemCard}
                    onPress={() => selectManualAttendee(item)}
                  >
                    <LinearGradient
                      colors={["#2563EB", "#16A34A"]}
                      style={styles.avatarCircle}
                    >
                      <Text style={styles.avatarText}>
                        {name.charAt(0).toUpperCase()}
                      </Text>
                    </LinearGradient>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.manualName} numberOfLines={1}>
                        {name}
                      </Text>

                      {!!designation && (
                        <Text
                          style={styles.manualDesignation}
                          numberOfLines={1}
                        >
                          {designation}
                        </Text>
                      )}

                      <Text style={styles.manualCompany} numberOfLines={1}>
                        {company}
                      </Text>

                      <Text style={styles.manualQr} numberOfLines={1}>
                        QR: {qr}
                      </Text>
                    </View>

                    <View style={styles.scanChip}>
                      <Zap size={14} color="#FFFFFF" />
                      <Text style={styles.scanChipText}>SCAN</Text>
                    </View>
                  </Pressable>
                );
              }}
            />
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
      <Modal visible={gateModal} transparent animationType="slide">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.7)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: "#0F172A",
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              padding: 20,
              maxHeight: "70%",
            }}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 22,
                fontWeight: "900",
                marginBottom: 18,
              }}
            >
              Select Gate
            </Text>

            <FlatList
              data={gates}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => {
                const active = settings?.gate?.id === item.id;

                return (
                  <Pressable
                    onPress={() => selectGate(item)}
                    style={{
                      backgroundColor: active ? "#2563EB" : "#111827",

                      borderRadius: 18,

                      padding: 16,

                      marginBottom: 10,

                      borderWidth: 1,

                      borderColor: active
                        ? "#60A5FA"
                        : "rgba(255,255,255,0.06)",
                    }}
                  >
                    <Text
                      style={{
                        color: "#FFFFFF",
                        fontWeight: "900",
                        fontSize: 16,
                      }}
                    >
                      {item.name}
                    </Text>

                    <Text
                      style={{
                        color: "#CBD5E1",
                        marginTop: 4,
                        fontWeight: "700",
                      }}
                    >
                      {item.code}
                    </Text>
                  </Pressable>
                );
              }}
            />

            <Pressable
              onPress={() => setGateModal(false)}
              style={{
                backgroundColor: "#EF4444",
                padding: 16,
                borderRadius: 18,
                alignItems: "center",
                marginTop: 12,
              }}
            >
              <Text
                style={{
                  color: "#FFFFFF",
                  fontWeight: "900",
                }}
              >
                CLOSE
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InfoChip({ icon, text }) {
  return (
    <View style={styles.infoChip}>
      {icon}
      <Text style={styles.infoChipText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

function MetricCard({ icon, label, value }) {
  return (
    <BlurView intensity={30} tint="dark" style={styles.metricCard}>
      <View style={styles.metricIcon}>{icon}</View>

      <View>
        <Text style={styles.metricValue}>{value}</Text>
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
    </BlurView>
  );
}

function ControlButton({ icon, label, onPress, active = false }) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(255,255,255,0.12)" }}
      style={[styles.controlButton, active && styles.controlButtonActive]}
    >
      {icon}
      <Text style={styles.controlLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
  },

  safe: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  headerShell: {
    borderRadius: 30,
    overflow: "hidden",
  },

  headerCard: {
    borderRadius: 30,
    padding: 14,
    overflow: "hidden",
    backgroundColor: "rgba(15,23,42,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  brandIcon: {
    width: 46,
    height: 46,
    borderRadius: 19,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },

  headerTextBox: {
    flex: 1,
    minWidth: 0,
  },

  headerTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
  },

  headerSub: {
    color: "#CBD5E1",
    fontSize: 13,
    marginTop: 4,
    fontWeight: "700",
  },

  headerBottom: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },

  infoChip: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(2,6,23,0.5)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  infoChipText: {
    color: "#CBD5E1",
    fontSize: 11,
    fontWeight: "800",
    flex: 1,
  },

  netPillOn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(6,78,59,0.95)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },

  netPillOff: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(127,29,29,0.95)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },

  netText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 10,
  },

  metricDock: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },

  metricCard: {
    flex: 1,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 12,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: "rgba(15,23,42,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },

  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  metricValue: {
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "900",
  },

  metricLabel: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 1,
  },

  segmentWrap: {
    marginTop: 12,
    borderRadius: 26,
    overflow: "hidden",
  },

  segment: {
    flexDirection: "row",
    borderRadius: 26,
    padding: 6,
    gap: 8,
    overflow: "hidden",
    backgroundColor: "rgba(15,23,42,0.76)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },

  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    flexDirection: "row",
    gap: 7,
  },

  segmentActiveIn: {
    backgroundColor: "#16A34A",
  },

  segmentActiveOut: {
    backgroundColor: "#EA580C",
  },

  segmentText: {
    fontWeight: "900",
    color: "#CBD5E1",
    fontSize: 12,
    letterSpacing: 0.5,
  },

  segmentTextActive: {
    color: "#FFFFFF",
  },

  scannerArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 60,
  },

  readyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(2,6,23,0.72)",
    marginBottom: 18,
  },

  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 99,
  },

  readyText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 1,
  },

  pulseRing: {
    position: "absolute",
    width: 318,
    height: 318,
    borderRadius: 159,
    borderWidth: 1,
    borderColor: "rgba(37,99,235,0.28)",
  },

  scanFrame: {
    width: 286,
    height: 286,
    justifyContent: "center",
    alignItems: "center",
  },

  scanGlass: {
    position: "absolute",
    width: 246,
    height: 246,
    borderRadius: 38,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(2,6,23,0.12)",
  },

  corner: {
    position: "absolute",
    width: 68,
    height: 68,
    borderColor: "#22C55E",
    shadowColor: "#22C55E",
    shadowOpacity: 1,
    shadowRadius: 14,
  },

  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 5,
    borderLeftWidth: 5,
    borderTopLeftRadius: 25,
  },

  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 5,
    borderRightWidth: 5,
    borderTopRightRadius: 25,
  },

  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 5,
    borderLeftWidth: 5,
    borderBottomLeftRadius: 25,
  },

  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 5,
    borderRightWidth: 5,
    borderBottomRightRadius: 25,
  },

  scanBeam: {
    position: "absolute",
    width: 218,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#22C55E",
    shadowColor: "#22C55E",
    shadowOpacity: 1,
    shadowRadius: 18,
  },

  processingBox: {
    position: "absolute",
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderRadius: 24,
    alignItems: "center",
    overflow: "hidden",
    backgroundColor: "rgba(2,6,23,0.74)",
  },

  processingText: {
    marginTop: 8,
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 13,
  },

  scanHint: {
    marginTop: 18,
    color: "#FFFFFF",
    fontWeight: "900",
    backgroundColor: "rgba(2,6,23,0.72)",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    overflow: "hidden",
    fontSize: 13,
  },

  bottomActions: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 84,
    alignItems: "center",
  },

  actionRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },

  controlButton: {
    minWidth: 72,
    height: 50,
    borderRadius: 20,
    backgroundColor: "rgba(15,23,42,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    gap: 3,
  },

  controlButtonActive: {
    backgroundColor: "#F59E0B",
  },

  controlLabel: {
    color: "#CBD5E1",
    fontSize: 9,
    fontWeight: "900",
  },

  zoomText: {
    color: "#CBD5E1",
    fontSize: 11,
    fontWeight: "900",
    marginTop: 8,
    backgroundColor: "rgba(15,23,42,0.78)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
  },

  syncToast: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 146,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    overflow: "hidden",
    backgroundColor: "rgba(15,23,42,0.9)",
  },

  syncToastText: {
    color: "#CBD5E1",
    fontWeight: "800",
    fontSize: 12,
  },

  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },

  resultHero: {
    position: "absolute",
    left: 16,
    right: 16,
    borderRadius: 32,
    borderWidth: 1.5,
    zIndex: 999,
    elevation: 25,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 22,
  },

  resultGradient: {
    padding: 20,
  },

  resultTopLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  resultIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  resultBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },

  resultBadgeText: {
    fontWeight: "900",
    fontSize: 11,
  },

  resultTitle: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 34,
    letterSpacing: -0.8,
    marginTop: 16,
  },

  resultPerson: {
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "900",
    marginTop: 10,
  },

  resultLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },

  resultDesignation: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "800",
    flex: 1,
  },

  resultCompany: {
    color: "#CBD5E1",
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },

  resultMessageHuman: {
    color: "#CBD5E1",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 14,
    fontWeight: "600",
  },

  resultMetaGrid: {
    flexDirection: "row",
    gap: 14,
    marginTop: 16,
  },

  resultMetaItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  resultMetaText: {
    color: "#CBD5E1",
    fontSize: 12,
    fontWeight: "800",
    flex: 1,
  },

  qrLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 12,
  },

  resultQR: {
    color: "#93C5FD",
    fontSize: 12,
    fontWeight: "800",
    flex: 1,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  permissionIcon: {
    width: 86,
    height: 86,
    borderRadius: 32,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },

  permissionTitle: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 22,
    marginTop: 18,
    marginBottom: 8,
  },

  permissionSub: {
    color: "#A9B8D0",
    textAlign: "center",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 20,
  },

  permissionButton: {
    borderRadius: 16,
  },

  manualContainer: {
    flex: 1,
    backgroundColor: "#020617",
    padding: 18,
  },

  manualHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    gap: 12,
  },

  manualIcon: {
    width: 50,
    height: 50,
    borderRadius: 20,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },

  manualTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
  },

  manualSubtitle: {
    color: "#91A4C2",
    fontSize: 13,
    marginTop: 4,
    fontWeight: "700",
  },

  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
  },

  manualSearchbar: {
    backgroundColor: "#111827",
    borderRadius: 20,
    marginBottom: 14,
  },

  manualSearchInput: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  manualLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },

  manualLoadingText: {
    color: "#CBD5E1",
    fontWeight: "800",
  },

  emptyBox: {
    backgroundColor: "#111827",
    borderRadius: 24,
    marginBottom: 12,
    padding: 24,
    alignItems: "center",
  },

  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 12,
  },

  emptySub: {
    color: "#91A4C2",
    marginTop: 5,
    fontWeight: "700",
  },

  manualItemCard: {
    backgroundColor: "#111827",
    borderRadius: 24,
    marginBottom: 10,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },

  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },

  avatarText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 20,
  },

  manualName: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },

  manualDesignation: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 3,
    fontWeight: "700",
  },

  manualCompany: {
    color: "#A9B8D0",
    fontSize: 13,
    marginTop: 3,
    fontWeight: "700",
  },

  manualQr: {
    color: "#60A5FA",
    fontSize: 12,
    marginTop: 5,
    fontWeight: "800",
  },

  scanChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#2563EB",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },

  scanChipText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },
});
