import React, { useEffect, useRef, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Modal,
  TextInput,
  FlatList,
} from "react-native";

import { CameraView, useCameraPermissions } from "expo-camera";
import * as Network from "expo-network";
import * as Device from "expo-device";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";

import { submitScan } from "../api/scan";
import { searchTickets } from "../api/tickets"; // ⭐ ADD THIS

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
function getFlashColor(status) {
  if (status === "SUCCESS") return "#00FF88"; // green
  if (status === "DUPLICATE") return "#FFD000"; // yellow
  if (status === "INVALID") return "#FF3B3B"; // red
  if (status === "OFFLINE") return "#4DA3FF"; // blue
  return "#FFFFFF";
}
function nowLabel() {
  return new Date().toLocaleTimeString();
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

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const { role } = useRole();

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
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [scanReady, setScanReady] = useState(true);
  const processingRef = useRef(false);
  const attendeeCacheRef = useRef({});
  const qrScanMemoryRef = useRef(new Map());
  const syncRunningRef = useRef(false);
  const hideCardTimerRef = useRef(null);
  const [insideCount, setInsideCount] = useState(0);
  const flashAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;

  const inSoundRef = useRef(null);
  const outSoundRef = useRef(null);
  const failSoundRef = useRef(null);

  const direction = settings.direction || "IN";
  const [zoom, setZoom] = useState(0.2);

  const [manualOpen, setManualOpen] = useState(false);
  const [manualQ, setManualQ] = useState("");
  const [manualItems, setManualItems] = useState([]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const s = await getSettings();
        if (mounted && s) {
          setSettingsState((prev) => ({ ...prev, ...s }));
        }

        const inS = await Audio.Sound.createAsync(
          require("../../assets/sounds/in.wav"),
        );
        inSoundRef.current = inS.sound;

        const outS = await Audio.Sound.createAsync(
          require("../../assets/sounds/out.wav"),
        );
        outSoundRef.current = outS.sound;

        const failS = await Audio.Sound.createAsync(
          require("../../assets/sounds/fail.wav"),
        );
        failSoundRef.current = failS.sound;

        const queue = await getOfflineQueue();
        if (mounted) {
          setPendingSyncCount(Array.isArray(queue) ? queue.length : 0);
        }

        const hour = new Date().getHours();
        if (hour >= 18 || hour <= 6) {
          setFlashOn(true);
        }
      } catch {}
    })();

    return () => {
      mounted = false;
      hideCardTimerRef.current && clearTimeout(hideCardTimerRef.current);
      inSoundRef.current?.unloadAsync?.();
      outSoundRef.current?.unloadAsync?.();
      failSoundRef.current?.unloadAsync?.();
    };
  }, []);

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
          if (error?.response?.data) {
            continue;
          }
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

  async function playForDirection(ok, directionValue) {
    try {
      if (!ok) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return failSoundRef.current?.replayAsync();
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (directionValue === "IN") {
        setEntryCount((c) => c + 1);
        setInsideCount((c) => c + 1);
        return inSoundRef.current?.replayAsync();
      }

      setExitCount((c) => c + 1);
      setInsideCount((c) => Math.max(0, c - 1));
      return outSoundRef.current?.replayAsync();
    } catch {}
  }

  function triggerFlash() {
    flashAnim.setValue(0);

    Animated.sequence([
      Animated.timing(flashAnim, {
        toValue: 0.85,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.timing(flashAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }

  function animateCard() {
    cardAnim.setValue(0);

    Animated.spring(cardAnim, {
      toValue: 1,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }

  function showCard(card) {
    setLastCard(card);
    animateCard();
    triggerFlash();

    if (hideCardTimerRef.current) {
      clearTimeout(hideCardTimerRef.current);
    }

    hideCardTimerRef.current = setTimeout(() => {
      setLastCard((prev) => (prev?.id === card.id ? null : prev));
    }, 3500);
  }

  async function makeCard({
    name,
    company,
    message,
    status,
    directionValue,
    qr, // ⭐ scanned QR
    gate, // ⭐ selected gate
    vip = false,
  }) {
    const now = Date.now();

    const card = {
      id: now + Math.floor(Math.random() * 1000),
      ts: now,
      name: name || "Unknown Attendee",
      company: company || "",
      message: message || "Recorded",
      direction: directionValue,
      status,
      qr_code: qr || "", // ⭐ store QR
      gate: gate || "Main Gate", // ⭐ store gate
      time_label: nowLabel(), // ⭐ correct time field
      vip,
    };

    await pushHistory(card);
    showCard(card);

    return card;
  }

  async function onScanPayload({ qr_code }) {
    if (!qr_code) return;

    const payload = {
      qr_code,
      direction,
      event_slug: settings?.event?.slug,
      gate_code: settings?.gate?.code,
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
        res?.attendee || attendeeCacheRef.current[qr_code] || null;
      const isVIP = !!attendee?.vip;

      await makeCard({
        name: attendee?.full_name,
        company: attendee?.company,
        message,
        status,
        directionValue: direction,
        qr: qr_code,
        gate: settings?.gate?.code || "Main Gate",
        vip: isVIP,
      });

      await playForDirection(status === "SUCCESS", direction);
    } catch (error) {
      if (error?.response?.data) {
        const apiData = error.response.data;
        const message = apiData?.message || "Scan failed";
        const status = detectStatus(message);

        if (apiData?.attendee) {
          attendeeCacheRef.current[qr_code] = apiData.attendee;
        }

        const cached = attendeeCacheRef.current[qr_code];
        const attendee = apiData?.attendee || cached || null;
        const isVIP = !!attendee?.vip;

        await makeCard({
          name: attendee?.full_name,
          company: attendee?.company,
          message,
          status,
          directionValue: direction,
          vip: isVIP,
        });

        await playForDirection(false, direction);
        return;
      }

      if (isOfflineLikeError(error)) {
        await enqueueOfflineScan(payload);

        const q = await getOfflineQueue();
        setPendingSyncCount(Array.isArray(q) ? q.length : 0);

        await makeCard({
          name: "Offline Scan",
          company: "",
          message: "Saved locally. Will sync when internet returns.",
          status: "OFFLINE",
          directionValue: direction,
        });

        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Warning,
        );
        await playForDirection(true, direction);
        return;
      }

      await makeCard({
        name: "Scan Failed",
        company: "",
        message: "Unexpected error while processing scan.",
        status: "INVALID",
        directionValue: direction,
      });

      await playForDirection(false, direction);
    }
  }

  async function runTicketSearch(q) {
    const event_slug = settings?.event?.slug;
    if (!event_slug) return;

    try {
      const data = await searchTickets({
        event_slug,
        q,
      });
      setManualItems(
        data?.items || data?.data || data?.attendees || data?.results || [],
      );
    } catch (error) {
      setManualItems([]);
    }
  }

  async function selectManualAttendee(item) {
    const qr_code = item.qr_code;

    setManualOpen(false);

    await onScanPayload({ qr_code });
  }

  const onBarcodeScanned = async ({ data }) => {
    const qr_code = String(data || "").trim();
    if (!qr_code) return;

    if (scanLocked) return;
    if (processingRef.current) return;

    const now = Date.now();
    const lastSeen = qrScanMemoryRef.current.get(qr_code);

    if (lastSeen && now - lastSeen < 2500) {
      return;
    }

    qrScanMemoryRef.current.set(qr_code, now);

    if (qrScanMemoryRef.current.size > 200) {
      const cleaned = new Map();

      for (const [key, time] of qrScanMemoryRef.current.entries()) {
        if (now - time < 10000) {
          cleaned.set(key, time);
        }
      }

      qrScanMemoryRef.current = cleaned;
    }

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
      }, 700);
    }
  };

  const setDirection = async (next) => {
    const updated = { ...settings, direction: next };
    setSettingsState(updated);
    await persistSettings(updated);
  };

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Camera permission required</Text>
        <Pressable style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionText}>Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>QR Scanner</Text>
          <Text style={styles.headerSub}>
            {settings?.event?.name || "Event"} • Gate{" "}
            {settings?.gate?.code || "-"}
          </Text>
          <Text style={styles.headerTiny}>
            Role: {role || "OPERATOR"} • Mode: {direction}
          </Text>
        </View>

        <View style={online ? styles.netOn : styles.netOff}>
          <Text style={styles.netText}>{online ? "ONLINE" : "OFFLINE"}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Entries</Text>
          <Text style={styles.statValue}>{entryCount}</Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Exits</Text>
          <Text style={styles.statValue}>{exitCount}</Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Pending Sync</Text>
          <Text style={styles.statValue}>{pendingSyncCount}</Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Sync</Text>
          <Text style={styles.statValueSmall}>
            {isSyncing ? "RUNNING" : "IDLE"}
          </Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Inside</Text>
          <Text style={styles.statValue}>{insideCount}</Text>
        </View>
      </View>

      <View style={styles.segment}>
        <Pressable
          onPress={() => setDirection("IN")}
          style={[styles.segmentBtn, direction === "IN" && styles.segmentIn]}
        >
          <Text style={styles.segmentText}>CHECK IN</Text>
        </Pressable>

        <Pressable
          onPress={() => setDirection("OUT")}
          style={[styles.segmentBtn, direction === "OUT" && styles.segmentOut]}
        >
          <Text style={styles.segmentText}>CHECK OUT</Text>
        </Pressable>
      </View>

      <Pressable style={styles.manualBtn} onPress={() => setManualOpen(true)}>
        <Text style={styles.manualText}>SEARCH ATTENDEE</Text>
      </Pressable>

      <View style={styles.scanDirection}>
        <Text style={styles.scanDirectionText}>
          {direction === "IN" ? "ENTRY MODE" : "EXIT MODE"}
        </Text>
      </View>
      <View
        style={[
          styles.scanReadyIndicator,
          scanReady ? styles.scanReady : styles.scanBusy,
        ]}
      >
        <Text style={styles.scanReadyText}>
          {scanReady ? "READY TO SCAN" : "PROCESSING"}
        </Text>
      </View>
      <View style={styles.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={flashOn}
          zoom={zoom}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={scanLocked ? undefined : onBarcodeScanned}
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

        <View style={styles.scanFrame} />

        <Text style={styles.scanHint}>Align QR inside the frame</Text>

        <Pressable
          style={styles.flashBtn}
          onPress={() => setFlashOn((prev) => !prev)}
        >
          <Text style={styles.flashText}>
            {flashOn ? "FLASH OFF" : "FLASH ON"}
          </Text>
        </Pressable>
      </View>
      <View style={styles.zoomRow}>
        <Pressable
          style={styles.zoomBtn}
          onPress={() => setZoom((z) => Math.max(0, z - 0.1))}
        >
          <Text style={styles.zoomText}>-</Text>
        </Pressable>

        <Pressable
          style={styles.zoomBtn}
          onPress={() => setZoom((z) => Math.min(1, z + 0.1))}
        >
          <Text style={styles.zoomText}>+</Text>
        </Pressable>
      </View>

      {lastCard && (
        <Animated.View
          style={[
            styles.resultCard,
            lastCard.status === "SUCCESS" && styles.resultSuccess,
            lastCard.status === "DUPLICATE" && styles.resultDuplicate,
            lastCard.status === "INVALID" && styles.resultInvalid,
            lastCard.status === "OFFLINE" && styles.resultOffline,
            {
              transform: [
                {
                  translateY: cardAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [80, 0],
                  }),
                },
              ],
              opacity: cardAnim,
            },
          ]}
        >
          <Text style={styles.resultStatus}>
            {lastCard.status === "SUCCESS" &&
              (lastCard.direction === "OUT"
                ? "EXIT RECORDED"
                : "ENTRY RECORDED")}

            {lastCard.status === "DUPLICATE" && "ALREADY SCANNED"}

            {lastCard.status === "INVALID" && "ACTION NOT ALLOWED"}

            {lastCard.status === "OFFLINE" && "OFFLINE SAVED"}
          </Text>

          <Text style={styles.resultName}>{lastCard.name}</Text>

          {lastCard.vip && <Text style={styles.vipBadge}>⭐ VIP ATTENDEE</Text>}

          {lastCard.company ? (
            <Text style={styles.resultCompany}>{lastCard.company}</Text>
          ) : null}

          <Text style={styles.resultMessage}>{lastCard.message}</Text>

          <Text style={styles.resultMeta}>
            {lastCard.direction} • {lastCard.time_label}
          </Text>

          <Text style={styles.resultQR}>QR: {lastCard.qr_code}</Text>
        </Animated.View>
      )}

      <Modal visible={manualOpen} animationType="slide">
        <View style={styles.manualContainer}>
          <Text style={styles.manualTitle}>Search Attendee</Text>

          <TextInput
            style={styles.manualInput}
            placeholder="Name / Email / Phone / Ticket ID"
            value={manualQ}
            onChangeText={(t) => {
              setManualQ(t);

              if (t.length >= 2) {
                runTicketSearch(t);
              } else {
                setManualItems([]);
              }
            }}
          />

          <FlatList
            data={manualItems}
            keyExtractor={(item, index) =>
              String(item.ticket_id || item.qr_code || index)
            }
            renderItem={({ item }) => {
              const attendee = item.attendee || {};

              return (
                <Pressable
                  style={styles.manualItem}
                  onPress={() => selectManualAttendee(item)}
                >
                  <Text style={styles.manualName}>
                    {attendee.full_name || "Unknown Attendee"}
                  </Text>

                  <Text style={styles.manualCompany}>
                    {attendee.company || ""}
                  </Text>
                </Pressable>
              );
            }}
          />

          <Pressable
            style={styles.manualClose}
            onPress={() => setManualOpen(false)}
          >
            <Text style={{ color: "white" }}>Close</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1220" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 12,
  },

  headerTitle: { color: "white", fontSize: 18, fontWeight: "900" },
  headerSub: { color: "#aaa", fontSize: 12, marginTop: 2 },
  headerTiny: { color: "#7f8aa3", fontSize: 11, marginTop: 4 },

  netOn: {
    backgroundColor: "#1e8f5a",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "center",
  },

  netOff: {
    backgroundColor: "#8f1e1e",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "center",
  },

  netText: { color: "white", fontWeight: "800", fontSize: 12 },

  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 6,
  },

  statBox: {
    flex: 1,
    backgroundColor: "#121B2E",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#1C2942",
  },

  statLabel: {
    color: "#8FA2C1",
    fontSize: 10,
    fontWeight: "700",
  },

  statValue: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 4,
  },

  statValueSmall: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 8,
  },

  segment: {
    flexDirection: "row",
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 6,
    gap: 8,
  },

  segmentBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#1A2338",
  },

  segmentIn: { backgroundColor: "#28B463" },
  segmentOut: { backgroundColor: "#E67E22" },

  segmentText: { fontWeight: "900", color: "#fff", letterSpacing: 0.5 },

  scanDirection: { alignItems: "center", paddingVertical: 6 },

  scanDirectionText: {
    color: "#fff",
    fontWeight: "800",
    letterSpacing: 0.7,
  },

  cameraWrap: {
    flex: 1,
    marginHorizontal: 14,
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#050A14",
  },

  scanFrame: {
    position: "absolute",
    width: 230,
    height: 230,
    borderWidth: 2.5,
    borderColor: "#00FFAA",
    alignSelf: "center",
    top: "31%",
    borderRadius: 18,
    backgroundColor: "transparent",
  },

  scanHint: {
    position: "absolute",
    bottom: 26,
    alignSelf: "center",
    color: "white",
    fontWeight: "700",
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
  },

  flashBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },

  flashText: {
    color: "white",
    fontWeight: "800",
    fontSize: 12,
  },

  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },

  resultCard: {
    margin: 14,
    padding: 18,
    borderRadius: 18,
    borderWidth: 2,
  },

  resultSuccess: {
    backgroundColor: "#14532D",
    borderColor: "#22C55E",
  },

  resultDuplicate: {
    backgroundColor: "#78350F",
    borderColor: "#F59E0B",
  },

  resultInvalid: {
    backgroundColor: "#7F1D1D",
    borderColor: "#EF4444",
  },

  resultOffline: {
    backgroundColor: "#1F2937",
    borderColor: "#60A5FA",
  },

  resultStatus: {
    color: "white",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 1,
  },

  resultName: {
    color: "white",
    fontSize: 26,
    fontWeight: "900",
    marginTop: 6,
  },

  vipBadge: {
    marginTop: 6,
    color: "#FFD700",
    fontWeight: "900",
    fontSize: 14,
  },

  resultCompany: {
    color: "#E2E8F0",
    fontSize: 14,
    marginTop: 2,
  },

  resultMessage: {
    color: "#F3F4F6",
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
  },

  resultMeta: {
    color: "#CBD5E1",
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0B1220",
    padding: 20,
  },

  text: { color: "white", fontWeight: "700", marginBottom: 12 },

  permissionBtn: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },

  permissionText: {
    color: "white",
    fontWeight: "800",
  },
  manualBtn: {
    backgroundColor: "#2563EB",
    marginHorizontal: 14,
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },

  manualText: {
    color: "white",
    fontWeight: "800",
  },

  manualContainer: {
    flex: 1,
    backgroundColor: "#0B1220",
    padding: 20,
  },

  manualTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 20,
  },

  manualInput: {
    backgroundColor: "#e0e0e0",
    color: "black",
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },

  manualItem: {
    backgroundColor: "#1F2937",
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },

  manualName: {
    color: "white",
    fontWeight: "800",
  },

  manualCompany: {
    color: "#aaa",
    fontSize: 12,
  },

  manualClose: {
    marginTop: 10,
    backgroundColor: "#ef4444",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  resultQR: {
    color: "#93C5FD",
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
  },
  zoomRow: {
    position: "absolute",
    bottom: 70,
    right: 16,
    flexDirection: "row",
    gap: 8,
  },

  zoomBtn: {
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },

  zoomText: {
    color: "white",
    fontWeight: "900",
    fontSize: 16,
  },
  scanReadyIndicator: {
    position: "absolute",
    top: 18,
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },

  scanReady: {
    backgroundColor: "#16A34A",
  },

  scanBusy: {
    backgroundColor: "#EF4444",
  },

  scanReadyText: {
    color: "white",
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 1,
  },
});
