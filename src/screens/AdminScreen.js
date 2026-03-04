import React, { useState } from "react";
import { View, Text, Pressable, TextInput, Alert } from "react-native";
import { useRole } from "../context/RoleContext";
import {
  pushHistory,
  getOfflineQueue,
  setOfflineQueue,
} from "../storage/scans";

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
      "Added 1,000 history items + 150 offline items.",
    );
  };

  return (
    <View className="flex-1 bg-[#0B1220] p-4">
      <Text className="text-white text-lg font-black mb-3">Admin</Text>

      <Text className="text-white/65 font-bold">Current role</Text>

      <Text className="text-white font-black mt-1 mb-4">{role}</Text>

      {!isAdmin ? (
        <View className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <Text className="text-white font-black mb-2">Unlock admin mode</Text>

          <TextInput
            value={pin}
            onChangeText={setPin}
            placeholder="Enter PIN"
            placeholderTextColor="rgba(255,255,255,0.45)"
            secureTextEntry
            keyboardType="number-pad"
            className="h-11 rounded-xl px-3 bg-white/5 border border-white/10 text-white font-black"
          />

          <Pressable
            onPress={unlock}
            className="mt-3 h-11 rounded-xl bg-[#79C2FF] items-center justify-center"
          >
            <Text className="text-[#0B1220] font-black">Unlock</Text>
          </Pressable>

          <Text className="text-white/60 mt-3 font-bold">
            Tip: long-press the IN/OUT switch on scanner to open admin.
          </Text>
        </View>
      ) : (
        <View className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <Text className="text-white font-black mb-3">Admin actions</Text>

          <Pressable
            onPress={simulate}
            className="h-11 rounded-xl bg-white/10 items-center justify-center"
          >
            <Text className="text-white font-black">
              Run stress-test (simulate 1,000 scans)
            </Text>
          </Pressable>

          <Pressable
            onPress={lock}
            className="h-11 rounded-xl bg-white/10 items-center justify-center mt-3"
          >
            <Text className="text-white font-black">Disable admin mode</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
