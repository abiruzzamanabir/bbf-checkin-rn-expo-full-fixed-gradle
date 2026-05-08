import React, { useEffect, useRef, useState } from "react";

import {
  View,
  StyleSheet,
  Text,
  Animated,
  StatusBar,
  Dimensions,
} from "react-native";

import LottieView from "lottie-react-native";

import * as Network from "expo-network";
import * as Device from "expo-device";

import { Audio } from "expo-av";

import { LinearGradient } from "expo-linear-gradient";

import * as Animatable from "react-native-animatable";

import { BlurView } from "expo-blur";

import {
  Activity,
  Smartphone,
  Wifi,
  ShieldCheck,
  QrCode,
} from "lucide-react-native";

import { getToken } from "../storage/token";

import { getSettings } from "../storage/settings";

const { width } = Dimensions.get("window");

const IS_SMALL = width < 390;

/* ---------------- STEPS ---------------- */

const STEPS = [
  {
    text: "Initializing secure environment...",
    progress: 15,
  },

  {
    text: "Checking network integrity...",
    progress: 35,
  },

  {
    text: "Loading event configuration...",
    progress: 55,
  },

  {
    text: "Registering scanner device...",
    progress: 75,
  },

  {
    text: "Preloading scanner engine...",
    progress: 90,
  },

  {
    text: "System ready",
    progress: 100,
  },
];

/* ---------------- MAIN ---------------- */

export default function SplashScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const pulseAnim = useRef(new Animated.Value(1)).current;

  const progressAnim = useRef(new Animated.Value(0)).current;

  const [stepIndex, setStepIndex] = useState(0);

  const [online, setOnline] = useState(true);

  const [deviceName, setDeviceName] = useState("");

  const initializedRef = useRef(false);

  useEffect(() => {
    run();

    pulseLoop();
  }, []);

  /* ---------------- CORE ---------------- */

  async function run() {
    if (initializedRef.current) {
      routeFast();

      return;
    }

    fadeIn();

    try {
      await bootSequence();

      initializedRef.current = true;

      routeFast();
    } catch {
      routeSafe();
    }
  }

  /* ---------------- BOOT ---------------- */

  async function bootSequence() {
    await step(0);

    const net = await Network.getNetworkStateAsync();

    setOnline(!!net.isConnected);

    await step(1);

    await getSettings();

    await step(2);

    const brand = Device.brand || "";

    const model = Device.modelName || "";

    const device = `${brand} ${model}`.trim();

    setDeviceName(device || "Unknown Device");

    await step(3);

    await preloadSounds();

    await step(4);

    await step(5);
  }

  /* ---------------- STEP ---------------- */

  function step(index) {
    return new Promise((resolve) => {
      setStepIndex(index);

      Animated.timing(progressAnim, {
        toValue: STEPS[index].progress,
        duration: 450,
        useNativeDriver: false,
      }).start();

      setTimeout(resolve, 420);
    });
  }

  /* ---------------- ANIMATION ---------------- */

  function fadeIn() {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 700,
      useNativeDriver: true,
    }).start();
  }

  function pulseLoop() {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),

        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }

  /* ---------------- AUDIO ---------------- */

  async function preloadSounds() {
    try {
      await Audio.Sound.createAsync(require("../../assets/sounds/in.wav"));

      await Audio.Sound.createAsync(require("../../assets/sounds/out.wav"));

      await Audio.Sound.createAsync(require("../../assets/sounds/fail.wav"));
    } catch {}
  }

  /* ---------------- ROUTE ---------------- */

  async function routeFast() {
    const token = await getToken();

    if (token) {
      navigation.replace("Main");
    } else {
      navigation.replace("Login");
    }
  }

  function routeSafe() {
    navigation.replace("Login");
  }

  /* ---------------- WIDTH ---------------- */

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],

    outputRange: ["0%", "100%"],
  });

  /* ---------------- UI ---------------- */

  return (
    <LinearGradient
      colors={["#020617", "#08111F", "#0F172A"]}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" />

      {/* GLOW */}

      <View style={styles.glow1} />

      <View style={styles.glow2} />

      {/* MAIN */}

      <Animated.View
        style={[
          styles.centerWrap,
          {
            opacity: fadeAnim,

            transform: [
              {
                scale: pulseAnim,
              },
            ],
          },
        ]}
      >
        {/* LOGO */}

        <Animatable.View animation="fadeInDown" duration={900}>
          <LinearGradient
            colors={["#2563EB", "#1D4ED8"]}
            style={styles.logoWrap}
          >
            <View style={styles.qrGlow} />

            <QrCode size={28} color="#FFFFFF" style={styles.qrIcon} />

            <LottieView
              source={require("../../assets/bbf-loader.json")}
              autoPlay
              loop
              style={styles.animation}
            />
          </LinearGradient>
        </Animatable.View>

        {/* TEXT */}

        <Animatable.View
          animation="fadeInUp"
          delay={250}
          duration={900}
          style={{
            width: "100%",
            alignItems: "center",
          }}
        >
          <Text style={styles.title}>BBF CHECK-IN</Text>

          <Text style={styles.subtitle}>
            Enterprise Event Operations Platform
          </Text>

          {/* GLASS CARD */}

          <BlurView intensity={30} tint="dark" style={styles.card}>
            {/* STATUS */}

            <View style={styles.stepRow}>
              <View style={styles.iconBox}>
                <Activity size={18} color="#60A5FA" />
              </View>

              <View
                style={{
                  flex: 1,
                }}
              >
                <Text style={styles.stepLabel}>SYSTEM STATUS</Text>

                <Text numberOfLines={1} style={styles.stepText}>
                  {STEPS[stepIndex].text}
                </Text>
              </View>

              <Text style={styles.percentText}>
                {STEPS[stepIndex].progress}%
              </Text>
            </View>

            {/* DEVICE */}

            <View style={styles.infoRow}>
              <View style={styles.smallIconBox}>
                <Smartphone size={15} color="#22C55E" />
              </View>

              <View
                style={{
                  flex: 1,
                }}
              >
                <Text style={styles.infoLabel}>DEVICE</Text>

                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={styles.infoText}
                >
                  {deviceName}
                </Text>
              </View>
            </View>

            {/* NETWORK */}

            <View style={styles.infoRow}>
              <View style={styles.smallIconBox}>
                <Wifi size={15} color={online ? "#22C55E" : "#EF4444"} />
              </View>

              <View
                style={{
                  flex: 1,
                }}
              >
                <Text style={styles.infoLabel}>CONNECTIVITY</Text>

                <Text
                  numberOfLines={1}
                  style={[
                    styles.infoText,
                    {
                      color: online ? "#22C55E" : "#F87171",
                    },
                  ]}
                >
                  {online ? "Online Secure Connection" : "Offline Mode"}
                </Text>
              </View>
            </View>

            {/* SECURITY */}

            <View style={styles.infoRow}>
              <View style={styles.smallIconBox}>
                <ShieldCheck size={15} color="#60A5FA" />
              </View>

              <View
                style={{
                  flex: 1,
                }}
              >
                <Text style={styles.infoLabel}>SECURITY</Text>

                <Text numberOfLines={1} style={styles.infoText}>
                  Secure enterprise mode
                </Text>
              </View>
            </View>

            {/* PROGRESS */}

            <View style={styles.progressWrap}>
              <View style={styles.progressTrack}>
                <Animated.View
                  style={[
                    styles.progressBar,
                    {
                      width: progressWidth,
                    },
                  ]}
                />
              </View>
            </View>
          </BlurView>
        </Animatable.View>
      </Animated.View>

      {/* FOOTER */}

      <Animatable.View animation="fadeIn" delay={700} style={styles.footer}>
        <Text style={styles.footerText}>Bangladesh Brand Forum</Text>

        <Text style={styles.footerSub}>Enterprise Event Intelligence</Text>
      </Animatable.View>
    </LinearGradient>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,

    justifyContent: "center",
    alignItems: "center",

    paddingHorizontal: 22,

    backgroundColor: "#020617",
  },

  centerWrap: {
    width: "100%",

    alignItems: "center",
  },

  glow1: {
    position: "absolute",

    width: 340,
    height: 340,

    borderRadius: 999,

    backgroundColor: "rgba(37,99,235,0.16)",

    top: -120,
    right: -100,
  },

  glow2: {
    position: "absolute",

    width: 260,
    height: 260,

    borderRadius: 999,

    backgroundColor: "rgba(34,197,94,0.10)",

    bottom: -60,
    left: -60,
  },

  logoWrap: {
    width: IS_SMALL ? 150 : 170,
    height: IS_SMALL ? 150 : 170,

    borderRadius: 999,

    justifyContent: "center",
    alignItems: "center",

    marginBottom: 26,

    overflow: "hidden",

    shadowColor: "#2563EB",

    shadowOpacity: 0.45,

    shadowRadius: 18,

    shadowOffset: {
      width: 0,
      height: 10,
    },

    elevation: 14,
  },

  qrGlow: {
    position: "absolute",

    width: 120,
    height: 120,

    borderRadius: 999,

    backgroundColor: "rgba(255,255,255,0.08)",
  },

  qrIcon: {
    position: "absolute",

    top: 18,

    opacity: 0.18,
  },

  animation: {
    width: IS_SMALL ? 135 : 150,
    height: IS_SMALL ? 135 : 150,
  },

  title: {
    color: "#FFFFFF",

    fontSize: IS_SMALL ? 30 : 34,

    fontWeight: "900",

    textAlign: "center",

    letterSpacing: 1,
  },

  subtitle: {
    color: "#94A3B8",

    textAlign: "center",

    marginTop: 8,

    marginBottom: 24,

    lineHeight: 20,

    fontSize: 13,

    paddingHorizontal: 12,
  },

  card: {
    width: "92%",

    borderRadius: 30,

    paddingVertical: 20,
    paddingHorizontal: 18,

    overflow: "hidden",

    borderWidth: 1,

    borderColor: "rgba(255,255,255,0.05)",

    backgroundColor: "rgba(15,23,42,0.72)",
  },

  stepRow: {
    flexDirection: "row",

    alignItems: "center",

    marginBottom: 18,
  },

  iconBox: {
    width: 42,
    height: 42,

    borderRadius: 16,

    backgroundColor: "rgba(37,99,235,0.12)",

    justifyContent: "center",
    alignItems: "center",

    marginRight: 12,
  },

  smallIconBox: {
    width: 34,
    height: 34,

    borderRadius: 12,

    backgroundColor: "rgba(255,255,255,0.05)",

    justifyContent: "center",
    alignItems: "center",

    marginRight: 12,
  },

  stepLabel: {
    color: "#64748B",

    fontSize: 10,

    fontWeight: "800",

    textTransform: "uppercase",

    letterSpacing: 1,
  },

  stepText: {
    color: "#FFFFFF",

    fontSize: 13,

    fontWeight: "700",

    marginTop: 4,
  },

  percentText: {
    color: "#60A5FA",

    fontSize: 12,

    fontWeight: "900",
  },

  infoRow: {
    flexDirection: "row",

    alignItems: "center",

    marginTop: 14,
  },

  infoLabel: {
    color: "#64748B",

    fontSize: 10,

    fontWeight: "800",

    textTransform: "uppercase",

    letterSpacing: 1,
  },

  infoText: {
    color: "#CBD5E1",

    fontSize: 12,

    fontWeight: "700",

    marginTop: 3,
  },

  progressWrap: {
    marginTop: 24,
  },

  progressTrack: {
    width: "100%",

    height: 10,

    borderRadius: 999,

    backgroundColor: "rgba(255,255,255,0.06)",

    overflow: "hidden",
  },

  progressBar: {
    height: "100%",

    borderRadius: 999,

    backgroundColor: "#2563EB",
  },

  footer: {
    position: "absolute",

    bottom: 34,

    alignItems: "center",
  },

  footerText: {
    color: "#64748B",

    fontSize: 12,

    fontWeight: "800",

    letterSpacing: 1,
  },

  footerSub: {
    color: "#475569",

    fontSize: 11,

    marginTop: 4,
  },
});
