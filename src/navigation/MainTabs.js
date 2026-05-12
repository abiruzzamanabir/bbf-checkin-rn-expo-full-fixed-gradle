import React, { useEffect, useState, useRef } from "react";

import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Text,
  Dimensions,
  Platform,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { BlurView } from "expo-blur";

import { LinearGradient } from "expo-linear-gradient";

import * as Haptics from "expo-haptics";

import {
  LayoutDashboard,
  History,
  ScanQrCode,
  ShieldCheck,
  BarChart3,
} from "lucide-react-native";

import HomeScreen from "../screens/HomeScreen";
import ScannerScreen from "../screens/ScannerScreen";
import HistoryScreen from "../screens/HistoryScreen";
import AdminScreen from "../screens/AdminScreen";
import AnalyticsScreen from "../screens/AnalyticsScreen";

import { getOfflineQueue } from "../storage/scans";

const Tab = createBottomTabNavigator();

const { width } = Dimensions.get("window");

/* ---------------- ENTERPRISE SCAN BUTTON ---------------- */

function EnterpriseScanButton({ children, onPress }) {
  const pulse = useRef(new Animated.Value(1)).current;

  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.08,
          duration: 1200,
          useNativeDriver: true,
        }),

        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 5000,
        useNativeDriver: true,
      }),
    ).start();
  }, []);

  const spin = rotate.interpolate({
    inputRange: [0, 1],

    outputRange: ["0deg", "360deg"],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={styles.scanButtonWrap}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        onPress?.();
      }}
    >
      {/* ROTATING RING */}

      <Animated.View
        style={[
          styles.outerRing,
          {
            transform: [
              {
                rotate: spin,
              },
            ],
          },
        ]}
      />

      {/* BUTTON */}

      <Animated.View
        style={{
          transform: [
            {
              scale: pulse,
            },
          ],
        }}
      >
        <LinearGradient
          colors={["#22C55E", "#16A34A", "#15803D"]}
          style={styles.scanGradient}
        >
          <BlurView intensity={25} tint="dark" style={styles.scanInner}>
            <ScanQrCode size={32} color="#FFFFFF" strokeWidth={2.5} />

            <View style={styles.liveDot} />
          </BlurView>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
}

/* ---------------- PREMIUM TAB ITEM ---------------- */

function PremiumTab({ focused, icon: Icon, label, badge }) {
  return (
    <View style={styles.tabItem}>
      {/* ACTIVE PILL */}

      {focused && (
        <LinearGradient
          colors={["rgba(34,197,94,0.20)", "rgba(34,197,94,0.05)"]}
          style={styles.activePill}
        />
      )}

      <View style={styles.iconContainer}>
        <Icon
          size={focused ? 22 : 20}
          color={focused ? "#22C55E" : "#64748B"}
          strokeWidth={focused ? 2.6 : 2.2}
        />

        {badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
          </View>
        )}
      </View>

      <Text style={[styles.label, focused && styles.labelFocused]}>
        {label}
      </Text>

      {/* ACTIVE LINE */}

      {focused && <View style={styles.activeLine} />}
    </View>
  );
}

/* ---------------- MAIN ---------------- */

export default function MainTabs() {
  const [pending, setPending] = useState(0);

  const [role, setRole] = useState("SCANNER");

  useEffect(() => {
    loadQueue();

    loadRole();

    const interval = setInterval(loadQueue, 3000);

    return () => clearInterval(interval);
  }, []);

  /* ---------------- LOAD ROLE ---------------- */

  async function loadRole() {
    try {
      const savedRole = await AsyncStorage.getItem("bbf_role");

      const finalRole = String(savedRole || "SCANNER").toUpperCase();

      console.log("// console", finalRole);

      setRole(finalRole);
    } catch (e) {
      console.log("ROLE LOAD ERROR:", e);

      setRole("SCANNER");
    }
  }

  /* ---------------- OFFLINE QUEUE ---------------- */

  async function loadQueue() {
    try {
      const q = await getOfflineQueue();

      setPending(Array.isArray(q) ? q.length : 0);
    } catch {
      setPending(0);
    }
  }

  /* ---------------- ROLE CHECK ---------------- */

  const isAdmin = role === "ADMIN";

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,

        tabBarStyle: {
          position: "absolute",
          height: 92,
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
        },

        tabBarBackground: () => (
          <View style={styles.tabBackground}>
            <BlurView intensity={45} tint="dark" style={styles.blur} />

            <LinearGradient
              colors={["rgba(255,255,255,0.10)", "transparent"]}
              style={styles.topGlow}
            />

            <LinearGradient
              colors={["rgba(34,197,94,0.25)", "transparent"]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.greenAccent}
            />
          </View>
        ),
      }}
    >
      {/* HOME */}

      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <PremiumTab
              focused={focused}
              icon={LayoutDashboard}
              label="Home"
              badge={0}
            />
          ),
        }}
      />

      {/* SCANNER */}

      <Tab.Screen
        name="Scanner"
        component={ScannerScreen}
        options={{
          tabBarButton: (props) => <EnterpriseScanButton {...props} />,
        }}
      />

      {/* HISTORY */}

      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <PremiumTab
              focused={focused}
              icon={History}
              label="History"
              badge={pending}
            />
          ),
        }}
      />

      {/* ADMIN */}

      <Tab.Screen
        name="Admin"
        component={AdminScreen}
        options={{
          tabBarItemStyle: {
            display: isAdmin ? "flex" : "none",
          },

          tabBarIcon: ({ focused }) => (
            <PremiumTab
              focused={focused}
              icon={ShieldCheck}
              label="Admin"
              badge={0}
            />
          ),
        }}
      />

      {/* ANALYTICS */}

      <Tab.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{
          tabBarItemStyle: {
            display: isAdmin ? "flex" : "none",
          },

          tabBarIcon: ({ focused }) => (
            <PremiumTab
              focused={focused}
              icon={BarChart3}
              label="Insights"
              badge={0}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  /* TAB BAR */

  tabBackground: {
    position: "absolute",

    left: 14,
    right: 14,

    bottom: Platform.OS === "ios" ? 20 : 12,

    height: 78,

    borderRadius: 34,

    overflow: "hidden",

    backgroundColor: "rgba(8,15,30,0.92)",

    borderWidth: 1,

    borderColor: "rgba(255,255,255,0.06)",
  },

  blur: {
    ...StyleSheet.absoluteFillObject,
  },

  topGlow: {
    position: "absolute",

    top: 0,

    width: "100%",

    height: 1.5,
  },

  greenAccent: {
    position: "absolute",

    top: 0,

    width: "100%",

    height: 3,
  },

  /* TAB ITEM */

  tabItem: {
    width: (width - 40) / 5,

    height: 72,

    justifyContent: "center",

    alignItems: "center",

    paddingTop: 8,
  },

  activePill: {
    position: "absolute",

    width: 54,
    height: 54,

    borderRadius: 20,
  },

  iconContainer: {
    justifyContent: "center",

    alignItems: "center",
  },

  label: {
    marginTop: 5,

    color: "#64748B",

    fontSize: 10,

    fontWeight: "800",

    letterSpacing: 0.2,
  },

  labelFocused: {
    color: "#22C55E",
  },

  activeLine: {
    width: 18,

    height: 3,

    borderRadius: 999,

    backgroundColor: "#22C55E",

    marginTop: 5,
  },

  /* FLOATING SCANNER */

  scanButtonWrap: {
    top: -32,

    justifyContent: "center",

    alignItems: "center",
  },

  outerRing: {
    position: "absolute",

    width: 92,
    height: 92,

    borderRadius: 999,

    borderWidth: 1.5,

    borderColor: "rgba(34,197,94,0.30)",

    borderStyle: "dashed",
  },

  scanGradient: {
    width: 82,
    height: 82,

    borderRadius: 999,

    justifyContent: "center",

    alignItems: "center",

    shadowColor: "#22C55E",

    shadowOffset: {
      width: 0,
      height: 10,
    },

    shadowOpacity: 0.45,

    shadowRadius: 22,

    elevation: 20,
  },

  scanInner: {
    width: 72,
    height: 72,

    borderRadius: 999,

    justifyContent: "center",

    alignItems: "center",

    overflow: "hidden",

    backgroundColor: "rgba(255,255,255,0.08)",

    borderWidth: 1.2,

    borderColor: "rgba(255,255,255,0.10)",
  },

  liveDot: {
    position: "absolute",

    top: 13,
    right: 13,

    width: 10,
    height: 10,

    borderRadius: 999,

    backgroundColor: "#22C55E",

    borderWidth: 2,

    borderColor: "rgba(255,255,255,0.20)",
  },

  /* BADGE */

  badge: {
    position: "absolute",

    top: -5,
    right: -12,

    minWidth: 18,

    height: 18,

    borderRadius: 999,

    backgroundColor: "#EF4444",

    justifyContent: "center",

    alignItems: "center",

    paddingHorizontal: 5,

    borderWidth: 2,

    borderColor: "#08111F",
  },

  badgeText: {
    color: "#FFFFFF",

    fontSize: 9,

    fontWeight: "900",
  },
});
