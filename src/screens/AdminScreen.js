import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Alert } from "react-native";
import { useRole } from "../context/RoleContext";
import { pushHistory, enqueueOfflineScan, getOfflineQueue, setOfflineQueue } from "../storage/scans";

const ADMIN_PIN = "2468";

export default function AdminScreen() {
  const { role, setRole } = useRole();
  const [pin, setPin] = useState("");

  const isAdmin = role === "ADMIN";

  const unlock = async () => {
    if (pin.trim() === ADMIN_PIN) {
      await setRole("ADMIN");
      setPin("");
      Alert.alert("Admin unlocked", "Admin mode enabled on this device.");
    } else {
      Alert.alert("Wrong PIN", "Please try again.");
    }
  };

  const lock = async () => {
    await setRole("OPERATOR");
    Alert.alert("Admin disabled", "Back to operator mode.");
  };

  const simulate = async () => {
    // 1000 scans in history + 150 offline queue items to test sync UI
    const now = Date.now();
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

    // Add some offline items to test progress bar
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

    Alert.alert("Stress test ready", "Added 1,000 history items + 150 offline items.");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Admin</Text>

      <Text style={styles.label}>Current role</Text>
      <Text style={styles.value}>{role}</Text>

      {!isAdmin ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Unlock admin mode</Text>
          <TextInput
            value={pin}
            onChangeText={setPin}
            placeholder="Enter PIN"
            placeholderTextColor="rgba(255,255,255,0.45)"
            secureTextEntry
            keyboardType="number-pad"
            style={styles.input}
          />
          <Pressable onPress={unlock} style={styles.primaryBtn}>
            <Text style={styles.primaryText}>Unlock</Text>
          </Pressable>
          <Text style={styles.hint}>Tip: long-press the IN/OUT switch on scanner to open admin.</Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Admin actions</Text>

          <Pressable onPress={simulate} style={styles.btn}>
            <Text style={styles.btnText}>Run stress-test (simulate 1,000 scans)</Text>
          </Pressable>

          <Pressable onPress={lock} style={[styles.btn, { marginTop: 10 }]}>
            <Text style={styles.btnText}>Disable admin mode</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1220", padding: 14 },
  title: { color: "white", fontSize: 18, fontWeight: "900", marginBottom: 12 },
  label: { color: "rgba(255,255,255,0.65)", fontWeight: "700" },
  value: { color: "white", fontWeight: "900", marginTop: 6, marginBottom: 14 },
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  cardTitle: { color: "white", fontWeight: "900", marginBottom: 10 },
  input: {
    height: 44,
    borderRadius: 14,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    color: "white",
    fontWeight: "900",
  },
  primaryBtn: {
    marginTop: 10,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#79C2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#0B1220", fontWeight: "900" },
  btn: {
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { color: "white", fontWeight: "900" },
  hint: { color: "rgba(255,255,255,0.60)", marginTop: 10, fontWeight: "700" },
});
