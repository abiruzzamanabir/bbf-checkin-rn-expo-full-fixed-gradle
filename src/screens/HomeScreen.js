import React, { useEffect, useState } from "react";
import { View, Text, Pressable, Modal, FlatList } from "react-native";
import { clearToken } from "../storage/token";
import { logout, me } from "../api/auth";
import { fetchEvents } from "../api/events";
import { fetchGates } from "../api/gates";
import { getSettings, setSettings } from "../storage/settings";

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
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 bg-black/60 justify-center p-5">
        <View className="bg-[#101a2d] rounded-2xl border border-[#1e2b45] p-4 max-h-[80%]">
          <Text className="text-white text-lg font-black mb-3">{title}</Text>

          <FlatList
            data={items}
            keyExtractor={keyExtractor}
            ItemSeparatorComponent={() => (
              <View className="h-[1px] bg-[#1e2b45]" />
            )}
            renderItem={({ item }) => (
              <Pressable
                className="py-3 px-2 rounded-xl"
                onPress={() => onPick(item)}
              >
                <Text className="text-white font-extrabold">
                  {renderLabel(item)}
                </Text>
              </Pressable>
            )}
          />

          <Pressable
            onPress={onClose}
            className="mt-3 py-3 rounded-xl bg-[#27324a] items-center"
          >
            <Text className="text-white font-bold">Close</Text>
          </Pressable>
        </View>
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

  useEffect(() => {
    (async () => {
      try {
        const data = await me();
        setUser(data.user || data);
      } catch {
        await clearToken();
        navigation.reset({ index: 0, routes: [{ name: "Login" }] });
        return;
      }

      const s = await getSettings();
      setLocalSettings(s);

      const evs = await fetchEvents();
      setEvents(evs);

      let chosenEvent = s.event;
      if (!chosenEvent && evs.length) chosenEvent = evs[0];

      if (chosenEvent) {
        const gs = await fetchGates(chosenEvent.slug);
        setGates(gs);

        let chosenGate = s.gate;
        if (!chosenGate && gs.length)
          chosenGate = gs.find((g) => g.is_active) || gs[0];

        const next = await setSettings({
          event: chosenEvent,
          gate: chosenGate,
        });

        setLocalSettings(next);
      }
    })();
  }, [navigation]);

  const eventName = settings.event?.name || "Select event";
  const gateName = settings.gate?.name
    ? `${settings.gate.name} (${settings.gate.code})`
    : "Select gate";

  async function onPickEvent(ev) {
    setEventModal(false);

    const gs = await fetchGates(ev.slug);
    setGates(gs);

    const firstGate = gs.length ? gs.find((g) => g.is_active) || gs[0] : null;

    const next = await setSettings({
      event: ev,
      gate: firstGate,
    });

    setLocalSettings(next);
  }

  async function onPickGate(g) {
    setGateModal(false);

    const next = await setSettings({ gate: g });
    setLocalSettings(next);
  }

  async function setDirection(direction) {
    const next = await setSettings({ direction });
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

  const canScan = !!settings.event && !!settings.direction;

  return (
    <View className="flex-1 bg-[#0b1220] p-5">
      <Text className="text-white text-2xl font-extrabold mt-2">
        BBF Check-in
      </Text>

      <Text className="text-[#b6c2d9] mt-2 mb-4">
        {user
          ? `Logged in as: ${user.name || "User"} (${user.role || "role"})`
          : "Loading profile..."}
      </Text>

      <Text className="text-white font-extrabold mb-2">Setup</Text>

      {/* Event selector */}
      <Pressable
        className="bg-[#101a2d] border border-[#1e2b45] rounded-xl p-3 mb-3"
        onPress={() => setEventModal(true)}
      >
        <Text className="text-[#7f8fb3] font-bold mb-1">Event</Text>
        <Text className="text-white font-extrabold">{eventName}</Text>
      </Pressable>

      {/* Gate selector */}
      <Pressable
        className={`bg-[#101a2d] border border-[#1e2b45] rounded-xl p-3 mb-3 ${
          !settings.event ? "opacity-50" : ""
        }`}
        disabled={!settings.event}
        onPress={() => setGateModal(true)}
      >
        <Text className="text-[#7f8fb3] font-bold mb-1">Gate</Text>
        <Text className="text-white font-extrabold">{gateName}</Text>
      </Pressable>

      {/* Direction toggle */}
      <View className="flex-row gap-3 mt-1 mb-4">
        <Pressable
          onPress={() => setDirection("IN")}
          className={`flex-1 p-3 rounded-xl border border-[#1e2b45] items-center ${
            settings.direction === "IN" ? "bg-[#2f6bff]" : "bg-[#101a2d]"
          }`}
        >
          <Text className="text-white font-black">IN</Text>
        </Pressable>

        <Pressable
          onPress={() => setDirection("OUT")}
          className={`flex-1 p-3 rounded-xl border border-[#1e2b45] items-center ${
            settings.direction === "OUT" ? "bg-[#2f6bff]" : "bg-[#101a2d]"
          }`}
        >
          <Text className="text-white font-black">OUT</Text>
        </Pressable>
      </View>

      {/* Scanner */}
      <Pressable
        disabled={!canScan}
        onPress={() => navigation.navigate("Scanner")}
        className={`p-4 rounded-xl items-center mt-2 ${
          canScan ? "bg-[#2f6bff]" : "bg-[#2f6bff]/50"
        }`}
      >
        <Text className="text-white font-extrabold">Open Scanner</Text>
      </Pressable>

      {/* Logout */}
      <Pressable
        onPress={onLogout}
        className="p-4 rounded-xl items-center mt-3 bg-[#27324a]"
      >
        <Text className="text-white font-extrabold">Logout</Text>
      </Pressable>

      <SelectModal
        visible={eventModal}
        title="Select Event"
        items={events}
        keyExtractor={(i) => String(i.id)}
        renderLabel={(i) => i.name}
        onPick={onPickEvent}
        onClose={() => setEventModal(false)}
      />

      <SelectModal
        visible={gateModal}
        title="Select Gate"
        items={gates.filter((g) => g.is_active)}
        keyExtractor={(i) => String(i.id)}
        renderLabel={(i) => `${i.name} (${i.code})`}
        onPick={onPickGate}
        onClose={() => setGateModal(false)}
      />
    </View>
  );
}
