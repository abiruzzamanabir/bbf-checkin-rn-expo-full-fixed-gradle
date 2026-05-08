import React, { useEffect, useRef, useState } from "react";

import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  FlatList,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Animated,
  Dimensions,
  ActivityIndicator,
} from "react-native";

import { BlurView } from "expo-blur";

import * as Haptics from "expo-haptics";

import { LinearGradient } from "expo-linear-gradient";

import {
  ScanLine,
  CalendarDays,
  DoorOpen,
  ChevronRight,
  LogOut,
  ShieldCheck,
  Activity,
  UserRound,
  ArrowDownCircle,
  ArrowUpCircle,
  Radio,
  X,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react-native";

import { clearToken } from "../storage/token";

import { logout, me } from "../api/auth";

import { fetchEvents } from "../api/events";

import { fetchGates } from "../api/gates";

import { getSettings, setSettings } from "../storage/settings";
import { useFocusEffect } from "@react-navigation/native";

const { width } = Dimensions.get("window");

function SelectModal({
  visible,
  title,
  items,
  keyExtractor,
  renderLabel,
  onPick,
  onClose,
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalBackdrop}>
        <BlurView intensity={45} tint="dark" style={styles.modalCard}>
          <View style={styles.modalHandle} />

          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>

            <Pressable style={styles.modalX} onPress={onClose}>
              <X size={20} color="#CBD5E1" />
            </Pressable>
          </View>

          <FlatList
            data={items}
            keyExtractor={keyExtractor}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <AlertTriangle size={22} color="#F59E0B" />

                <Text style={styles.emptyText}>No item found</Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [
                  styles.modalItem,
                  pressed && {
                    opacity: 0.85,
                    transform: [{ scale: 0.98 }],
                  },
                ]}
                onPress={() => onPick(item)}
              >
                <View style={styles.modalItemLeft}>
                  <View style={styles.modalItemIcon}>
                    <CheckCircle2 size={17} color="#22C55E" />
                  </View>

                  <Text numberOfLines={1} style={styles.modalItemText}>
                    {renderLabel(item)}
                  </Text>
                </View>

                <ChevronRight size={18} color="#64748B" />
              </Pressable>
            )}
          />
        </BlurView>
      </View>
    </Modal>
  );
}

export default function HomeScreen({ navigation }) {
  const [user, setUser] = useState(null);

  const [events, setEvents] = useState([]);

  const [gates, setGates] = useState([]);

  const [settings, setLocalSettings] = useState({
    event: null,
    gate: null,
    direction: "IN",
  });

  const [eventModal, setEventModal] = useState(false);

  const [gateModal, setGateModal] = useState(false);

  const [loading, setLoading] = useState(true);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),

      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.03,
          duration: 1200,
          useNativeDriver: true,
        }),

        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;

      async function reload() {
        try {
          if (!mounted) return;

          await loadInitialData();
        } catch (e) {
          console.log("HOME RELOAD ERROR:", e);
        }
      }

      reload();

      return () => {
        mounted = false;
      };
    }, []),
  );

  async function loadInitialData() {
    try {
      setLoading(true);

      try {
        const data = await me();

        setUser(data.user || data);
      } catch {
        await clearToken();

        navigation.reset({
          index: 0,
          routes: [{ name: "Login" }],
        });

        return;
      }

      const savedSettings = await getSettings();

      /* FETCH LATEST EVENTS */

      const evs = await fetchEvents();

      const cleanEvents = Array.isArray(evs) ? evs : [];

      setEvents(cleanEvents);

      /* -------------------------------- */
      /* VERIFY LOCAL EVENT STILL EXISTS  */
      /* -------------------------------- */

      let chosenEvent = null;

      if (savedSettings?.event?.id) {
        chosenEvent =
          cleanEvents.find(
            (e) => Number(e.id) === Number(savedSettings.event.id),
          ) || null;
      }

      /* FALLBACK */

      if (!chosenEvent) {
        chosenEvent = cleanEvents?.[0] || null;
      }

      /* -------------------------------- */
      /* UPDATE LOCAL STORAGE IF CHANGED  */
      /* -------------------------------- */

      if (
        chosenEvent &&
        (chosenEvent?.name !== savedSettings?.event?.name ||
          chosenEvent?.slug !== savedSettings?.event?.slug)
      ) {
        console.log("EVENT MISMATCH DETECTED → UPDATING LOCAL STORAGE");

        await setSettings({
          event: chosenEvent,
        });
      }

      if (!chosenEvent) {
        setLocalSettings({
          event: null,
          gate: null,
          direction: savedSettings?.direction || "IN",
        });

        return;
      }

      const gs = await fetchGates(chosenEvent?.slug);

      setGates(Array.isArray(gs) ? gs : []);

      let chosenGate = null;

      /* VERIFY SAVED GATE EXISTS */

      if (savedSettings?.gate?.id) {
        chosenGate =
          gs.find((g) => Number(g.id) === Number(savedSettings.gate.id)) ||
          null;
      }

      /* FALLBACK */

      if (!chosenGate) {
        chosenGate = gs.find((g) => Boolean(g.is_active)) || gs?.[0] || null;
      }

      /* -------------------------------- */
      /* UPDATE LOCAL GATE IF MISMATCH    */
      /* -------------------------------- */

      if (
        chosenGate &&
        (chosenGate?.name !== savedSettings?.gate?.name ||
          chosenGate?.code !== savedSettings?.gate?.code)
      ) {
        console.log("GATE MISMATCH DETECTED → UPDATING STORAGE");

        await setSettings({
          gate: chosenGate,
        });
      }

      const next = await setSettings({
        event: chosenEvent,
        gate: chosenGate,
        direction: savedSettings?.direction || "IN",
      });

      setLocalSettings(next);
    } catch (e) {
      // console.log("HOME LOAD ERROR:", e);
    } finally {
      setLoading(false);
    }
  }

  const canScan = !!settings?.event && !!settings?.gate;

  async function onPickEvent(ev) {
    Haptics.selectionAsync();

    setEventModal(false);

    const gs = await fetchGates(ev.slug);

    setGates(Array.isArray(gs) ? gs : []);

    const autoGate = gs.find((g) => Boolean(g.is_active)) || gs?.[0] || null;

    const next = await setSettings({
      event: ev,
      gate: autoGate,
    });

    setLocalSettings(next);
  }

  async function onPickGate(gate) {
    Haptics.selectionAsync();

    setGateModal(false);

    const next = await setSettings({
      gate,
    });

    setLocalSettings(next);
  }

  async function changeDirection(direction) {
    Haptics.selectionAsync();

    const next = await setSettings({
      direction,
    });

    setLocalSettings(next);
  }

  async function onLogout() {
    try {
      await logout();
    } catch {}

    await clearToken();

    navigation.reset({
      index: 0,
      routes: [{ name: "Login" }],
    });
  }

  if (loading) {
    return (
      <LinearGradient
        colors={["#020617", "#071226", "#0B1220"]}
        style={styles.loadingScreen}
      >
        <ActivityIndicator color="#22C55E" size="large" />

        <Text style={styles.loadingText}>Loading operations...</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={["#020617", "#071226", "#0B1220"]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" />

        <View style={styles.glow1} />

        <View style={styles.glow2} />

        <Animated.View
          style={[
            styles.screenAnim,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.topBar}>
              <View>
                <Text style={styles.header}>BBF CHECK-IN</Text>

                <Text style={styles.subHeader}>
                  Enterprise Event Operations
                </Text>
              </View>

              <Animated.View
                style={{
                  transform: [{ scale: pulseAnim }],
                }}
              >
                <LinearGradient
                  colors={["#22C55E", "#16A34A", "#15803D"]}
                  style={styles.hudIcon}
                >
                  <ScanLine size={25} color="#FFFFFF" />
                </LinearGradient>
              </Animated.View>
            </View>

            <BlurView intensity={35} tint="dark" style={styles.profileCard}>
              <View style={styles.profileTop}>
                <LinearGradient
                  colors={["#2563EB", "#1D4ED8"]}
                  style={styles.avatar}
                >
                  {user?.name ? (
                    <Text style={styles.avatarText}>
                      {user.name.charAt(0).toUpperCase()}
                    </Text>
                  ) : (
                    <UserRound size={24} color="#FFFFFF" />
                  )}
                </LinearGradient>

                <View style={styles.profileInfo}>
                  <Text numberOfLines={1} style={styles.profileName}>
                    {user?.name || "User"}
                  </Text>

                  <Text numberOfLines={1} style={styles.profileRole}>
                    {user?.role || "Scanner Operator"}
                  </Text>
                </View>

                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />

                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              </View>
            </BlurView>

            <Text style={styles.section}>EVENT CONFIGURATION</Text>

            <Pressable
              style={({ pressed }) => [
                styles.configCard,
                pressed && styles.pressed,
              ]}
              onPress={() => setEventModal(true)}
            >
              <View style={styles.configLeft}>
                <View style={styles.configIcon}>
                  <CalendarDays size={19} color="#22C55E" />
                </View>

                <View style={styles.configTextWrap}>
                  <Text style={styles.configLabel}>Selected Event</Text>

                  <Text numberOfLines={1} style={styles.configValue}>
                    {settings?.event?.name || "Select Event"}
                  </Text>
                </View>
              </View>

              <ChevronRight size={19} color="#64748B" />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.configCard,
                pressed && styles.pressed,
              ]}
              onPress={() => setGateModal(true)}
            >
              <View style={styles.configLeft}>
                <View style={styles.configIcon}>
                  <DoorOpen size={19} color="#22C55E" />
                </View>

                <View style={styles.configTextWrap}>
                  <Text style={styles.configLabel}>Selected Gate</Text>

                  <Text numberOfLines={1} style={styles.configValue}>
                    {settings?.gate
                      ? `${settings.gate.name} (${settings.gate.code})`
                      : "Select Gate"}
                  </Text>
                </View>
              </View>

              <ChevronRight size={19} color="#64748B" />
            </Pressable>

            <Text style={styles.section}>SCANNING MODE</Text>

            <View style={styles.modeWrap}>
              <Pressable
                style={[
                  styles.modeBtn,
                  settings.direction === "IN" && styles.modeBtnIn,
                ]}
                onPress={() => changeDirection("IN")}
              >
                <ArrowDownCircle size={20} color="#FFFFFF" />

                <View>
                  <Text style={styles.modeText}>CHECK IN</Text>

                  <Text style={styles.modeSub}>Entry Scan</Text>
                </View>
              </Pressable>

              <Pressable
                style={[
                  styles.modeBtn,
                  settings.direction === "OUT" && styles.modeBtnOut,
                ]}
                onPress={() => changeDirection("OUT")}
              >
                <ArrowUpCircle size={20} color="#FFFFFF" />

                <View>
                  <Text style={styles.modeText}>CHECK OUT</Text>

                  <Text style={styles.modeSub}>Exit Scan</Text>
                </View>
              </Pressable>
            </View>

            <BlurView intensity={30} tint="dark" style={styles.statusCard}>
              <View style={styles.statusLeft}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: canScan ? "#22C55E" : "#EF4444",
                    },
                  ]}
                />

                <View>
                  <Text style={styles.statusTitle}>
                    {canScan ? "Scanner Ready" : "Scanner Not Ready"}
                  </Text>

                  <Text style={styles.statusSub}>
                    {canScan
                      ? "Event and gate configured successfully"
                      : "Please select event and gate first"}
                  </Text>
                </View>
              </View>

              <Radio size={19} color={canScan ? "#22C55E" : "#EF4444"} />
            </BlurView>

            <Animated.View
              style={{
                transform: [{ scale: pulseAnim }],
              }}
            >
              <Pressable
                disabled={!canScan}
                style={({ pressed }) => [
                  styles.scanButton,
                  !canScan && styles.disabled,
                  pressed && styles.pressed,
                ]}
                onPress={() => navigation.navigate("Scanner")}
              >
                <LinearGradient
                  colors={["#22C55E", "#16A34A", "#15803D"]}
                  style={styles.scanGradient}
                >
                  <View style={styles.scanInner}>
                    <View>
                      <Text style={styles.scanText}>OPEN SCANNER</Text>

                      <Text style={styles.scanSub}>
                        Enterprise QR Validation
                      </Text>
                    </View>

                    <View style={styles.scanIconBig}>
                      <ScanLine size={34} color="#FFFFFF" />
                    </View>
                  </View>
                </LinearGradient>
              </Pressable>
            </Animated.View>

            <View style={styles.miniStats}>
              <BlurView intensity={25} tint="dark" style={styles.miniCard}>
                <ShieldCheck size={18} color="#22C55E" />

                <Text style={styles.miniLabel}>Access</Text>

                <Text style={styles.miniValue}>Secure</Text>
              </BlurView>

              <BlurView intensity={25} tint="dark" style={styles.miniCard}>
                <Activity size={18} color="#60A5FA" />

                <Text style={styles.miniLabel}>Status</Text>

                <Text style={styles.miniValue}>
                  {canScan ? "Ready" : "Setup"}
                </Text>
              </BlurView>
            </View>

            <Pressable style={styles.logoutBtn} onPress={onLogout}>
              <LogOut size={17} color="#94A3B8" />

              <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
          </ScrollView>
        </Animated.View>

        <SelectModal
          visible={eventModal}
          title="Select Event"
          items={events}
          keyExtractor={(item) => String(item.id)}
          renderLabel={(item) => item.name}
          onPick={onPickEvent}
          onClose={() => setEventModal(false)}
        />

        <SelectModal
          visible={gateModal}
          title="Select Gate"
          items={gates.filter((g) => Boolean(g.is_active))}
          keyExtractor={(item) => String(item.id)}
          renderLabel={(item) => `${item.name} (${item.code})`}
          onPick={onPickGate}
          onClose={() => setGateModal(false)}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  safe: {
    flex: 1,
  },

  screenAnim: {
    flex: 1,
  },

  loadingScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: {
    color: "#94A3B8",
    marginTop: 14,
    fontWeight: "700",
  },

  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },

  glow1: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.10)",
    top: -90,
    right: -110,
  },

  glow2: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: "rgba(59,130,246,0.08)",
    bottom: -90,
    left: -90,
  },

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },

  header: {
    color: "#FFFFFF",
    fontSize: 31,
    fontWeight: "900",
    letterSpacing: -0.8,
  },

  subHeader: {
    color: "#64748B",
    marginTop: 4,
    fontSize: 13,
    fontWeight: "600",
  },

  hudIcon: {
    width: 54,
    height: 54,
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#22C55E",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 10,
  },

  profileCard: {
    borderRadius: 28,
    padding: 16,
    overflow: "hidden",
    marginBottom: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(15,23,42,0.72)",
  },

  profileTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  avatar: {
    width: 56,
    height: 56,
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },

  avatarText: {
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "900",
  },

  profileInfo: {
    flex: 1,
    minWidth: 0,
  },

  profileName: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
  },

  profileRole: {
    color: "#94A3B8",
    marginTop: 4,
    fontSize: 13,
    fontWeight: "600",
  },

  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(34,197,94,0.12)",
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.18)",
  },

  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#22C55E",
    marginRight: 6,
  },

  liveText: {
    color: "#22C55E",
    fontWeight: "900",
    fontSize: 11,
  },

  section: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginBottom: 10,
    marginLeft: 2,
  },

  configCard: {
    backgroundColor: "rgba(15,23,42,0.88)",
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },

  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },

  configLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },

  configIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: "rgba(34,197,94,0.10)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },

  configTextWrap: {
    flex: 1,
    minWidth: 0,
  },

  configLabel: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "800",
  },

  configValue: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
    marginTop: 5,
    maxWidth: width - 165,
  },

  modeWrap: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 22,
  },

  modeBtn: {
    flex: 1,
    minHeight: 62,
    borderRadius: 22,
    backgroundColor: "rgba(15,23,42,0.82)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },

  modeBtnIn: {
    backgroundColor: "#16A34A",
    borderColor: "rgba(34,197,94,0.55)",
  },

  modeBtnOut: {
    backgroundColor: "#EA580C",
    borderColor: "rgba(249,115,22,0.55)",
  },

  modeText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 13,
  },

  modeSub: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 11,
    marginTop: 2,
    fontWeight: "600",
  },

  statusCard: {
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 17,
    marginBottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    backgroundColor: "rgba(15,23,42,0.72)",
  },

  statusLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  statusDot: {
    width: 11,
    height: 11,
    borderRadius: 999,
    marginRight: 13,
  },

  statusTitle: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
  },

  statusSub: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 3,
    fontWeight: "600",
  },

  scanButton: {
    borderRadius: 32,
    overflow: "hidden",
    shadowColor: "#22C55E",
    shadowOpacity: 0.4,
    shadowRadius: 22,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    elevation: 8,
  },

  disabled: {
    opacity: 0.45,
  },

  scanGradient: {
    minHeight: 112,
    paddingHorizontal: 22,
    justifyContent: "center",
  },

  scanInner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  scanText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  scanSub: {
    color: "rgba(255,255,255,0.78)",
    marginTop: 6,
    fontSize: 13,
    fontWeight: "700",
  },

  scanIconBig: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.14)",
    justifyContent: "center",
    alignItems: "center",
  },

  miniStats: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },

  miniCard: {
    flex: 1,
    borderRadius: 22,
    padding: 16,
    overflow: "hidden",
    backgroundColor: "rgba(15,23,42,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },

  miniLabel: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 10,
  },

  miniValue: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 3,
  },

  logoutBtn: {
    marginTop: 24,
    marginBottom: 40,
    alignSelf: "center",
    paddingHorizontal: 18,
    height: 54,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },

  logoutText: {
    color: "#94A3B8",
    fontWeight: "800",
    fontSize: 13,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.82)",
    justifyContent: "flex-end",
  },

  modalCard: {
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    padding: 20,
    maxHeight: "76%",
    overflow: "hidden",
    backgroundColor: "rgba(15,23,42,0.94)",
  },

  modalHandle: {
    width: 54,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#334155",
    alignSelf: "center",
    marginBottom: 16,
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },

  modalTitle: {
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "900",
  },

  modalX: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    justifyContent: "center",
    alignItems: "center",
  },

  modalItem: {
    backgroundColor: "rgba(15,23,42,0.92)",
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },

  modalItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },

  modalItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: "rgba(34,197,94,0.10)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  modalItemText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    flex: 1,
  },

  emptyBox: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyText: {
    color: "#94A3B8",
    fontWeight: "800",
    marginTop: 10,
  },
});
