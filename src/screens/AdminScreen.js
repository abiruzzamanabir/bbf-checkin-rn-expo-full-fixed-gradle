import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";

import { useRole } from "../context/RoleContext";
import {
  pushHistory,
  enqueueOfflineScan,
  getOfflineQueue,
  setOfflineQueue,
} from "../storage/scans";

const ADMIN_PIN = "2468";

export default function AdminScreen() {
  const { role, setRole } = useRole();

  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  const isAdmin = role === "ADMIN";

  const unlock = async () => {
    if (!pin.trim()) return;

    if (pin.trim() === ADMIN_PIN) {
      await setRole("ADMIN");
      setPin("");
      Alert.alert("Admin enabled", "You now have admin access.");
    } else {
      Alert.alert("Incorrect PIN", "Try again.");
    }
  };

  const lock = async () => {
    await setRole("OPERATOR");
    Alert.alert("Admin disabled", "Switched back to operator mode.");
  };

  const simulate = async () => {
    try {
      setLoading(true);

      const now = Date.now();

      // HISTORY
      for (let i = 0; i < 1000; i++) {
        const dir = i % 2 === 0 ? "IN" : "OUT";

        await pushHistory({
          id: `SIM-${now}-${i}`,
          ts: now + i,
          time_label: new Date(now + i * 1000).toLocaleTimeString(),
          direction: dir,
          status: "SUCCESS",
          qr_code: `BBF-SIM-${String(i).padStart(4, "0")}`,
          name: `Sim User ${i + 1}`,
          company: "Stress Test",
          message: "Simulated scan",
        });
      }

      // OFFLINE QUEUE
      const offline = await getOfflineQueue();

      const extra = [];
      for (let i = 0; i < 150; i++) {
        extra.push({
          qr_code: `BBF-OFF-${String(i).padStart(4, "0")}`,
          event_slug: "stress-test",
          direction: i % 2 === 0 ? "IN" : "OUT",
          gate_code: "SIM",
          device_uuid: "SIMULATOR",
          ts: now + i,
        });
      }

      await setOfflineQueue([...offline, ...extra]);

      Alert.alert(
        "Stress test ready",
        "1,000 scans + 150 offline items added.",
      );
    } catch (e) {
      Alert.alert("Error", "Simulation failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.title}>Admin Panel</Text>

        <View
          style={[
            styles.roleBadge,
            isAdmin ? styles.adminBadge : styles.operatorBadge,
          ]}
        >
          <Text style={styles.roleText}>{role}</Text>
        </View>
      </View>

      {/* LOCKED VIEW */}
      {!isAdmin ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Unlock Admin Access</Text>
          <Text style={styles.subText}>
            Enter PIN to enable advanced controls.
          </Text>

          <TextInput
            value={pin}
            onChangeText={setPin}
            placeholder="Enter PIN"
            placeholderTextColor="#6B7280"
            secureTextEntry
            keyboardType="number-pad"
            style={styles.input}
          />

          <Pressable onPress={unlock} style={styles.primaryBtn}>
            <Text style={styles.primaryText}>Unlock</Text>
          </Pressable>

          <Text style={styles.hint}>
            Long-press IN/OUT switch on scanner to open admin.
          </Text>
        </View>
      ) : (
        /* ADMIN VIEW */
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Admin Controls</Text>

          {/* STRESS TEST */}
          <Pressable onPress={simulate} style={styles.actionBtn}>
            {loading ? (
              <ActivityIndicator />
            ) : (
              <>
                <Text style={styles.actionTitle}>Run Stress Test</Text>
                <Text style={styles.actionSub}>
                  Simulates 1,000 scans + 150 offline entries
                </Text>
              </>
            )}
          </Pressable>

          {/* LOCK */}
          <Pressable onPress={lock} style={styles.dangerBtn}>
            <Text style={styles.dangerText}>Disable Admin Mode</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#08111F",
    padding: 16,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
  },

  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },

  adminBadge: {
    backgroundColor: "#14532D",
  },

  operatorBadge: {
    backgroundColor: "#1E293B",
  },

  roleText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
  },

  card: {
    backgroundColor: "#111827",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#1F2937",
  },

  cardTitle: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 18,
    marginBottom: 8,
  },

  subText: {
    color: "#9CA3AF",
    marginBottom: 12,
    fontWeight: "600",
  },

  input: {
    height: 48,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#263856",
    color: "#FFFFFF",
    fontWeight: "900",
  },

  primaryBtn: {
    marginTop: 12,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
  },

  primaryText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  actionBtn: {
    backgroundColor: "#1E293B",
    padding: 14,
    borderRadius: 16,
    marginTop: 10,
  },

  actionTitle: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 14,
  },

  actionSub: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 4,
  },

  dangerBtn: {
    marginTop: 14,
    backgroundColor: "#7F1D1D",
    padding: 14,
    borderRadius: 16,
    alignItems: "center",
  },

  dangerText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  hint: {
    color: "#6B7280",
    marginTop: 10,
    fontSize: 12,
  },
});
