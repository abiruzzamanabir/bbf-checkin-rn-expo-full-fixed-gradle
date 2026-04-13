import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  FlatList,
} from "react-native";

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
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>

          <FlatList
            data={items}
            keyExtractor={keyExtractor}
            renderItem={({ item }) => (
              <Pressable style={styles.modalItem} onPress={() => onPick(item)}>
                <Text style={styles.modalItemText}>{renderLabel(item)}</Text>
              </Pressable>
            )}
          />

          <Pressable style={styles.modalClose} onPress={onClose}>
            <Text style={styles.modalCloseText}>Close</Text>
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
  }, []);

  const eventName = settings.event?.name || "Select event";
  const gateName = settings.gate?.name
    ? `${settings.gate.name} (${settings.gate.code})`
    : "Select gate";

  async function onPickEvent(ev) {
    setEventModal(false);
    const gs = await fetchGates(ev.slug);
    setGates(gs);

    const firstGate = gs.find((g) => g.is_active) || gs[0] || null;

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

  const canScan = !!settings.event && !!settings.gate;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>BBF Check-in</Text>

      <View style={styles.profileCard}>
        <Text style={styles.profileName}>{user?.name || "User"}</Text>

        <Text style={styles.profileRole}>{user?.role || "Operator"}</Text>
      </View>

      <Text style={styles.section}>Scanner Setup</Text>

      <Pressable style={styles.selector} onPress={() => setEventModal(true)}>
        <Text style={styles.selectorLabel}>Event</Text>
        <Text style={styles.selectorValue}>{eventName}</Text>
      </Pressable>

      <Pressable style={styles.selector} onPress={() => setGateModal(true)}>
        <Text style={styles.selectorLabel}>Gate</Text>
        <Text style={styles.selectorValue}>{gateName}</Text>
      </Pressable>

      <View style={styles.toggleRow}>
        <Pressable
          style={[
            styles.toggle,
            settings.direction === "IN" && styles.toggleActive,
          ]}
          onPress={() => setDirection("IN")}
        >
          <Text style={styles.toggleText}>CHECK IN</Text>
        </Pressable>

        <Pressable
          style={[
            styles.toggle,
            settings.direction === "OUT" && styles.toggleActive,
          ]}
          onPress={() => setDirection("OUT")}
        >
          <Text style={styles.toggleText}>CHECK OUT</Text>
        </Pressable>
      </View>

      <Pressable
        style={[styles.scanButton, !canScan && { opacity: 0.5 }]}
        disabled={!canScan}
        onPress={() => navigation.navigate("Scanner")}
      >
        <Text style={styles.scanText}>Open Scanner</Text>
      </Pressable>

      <Pressable style={styles.logoutBtn} onPress={onLogout}>
        <Text style={styles.logoutText}>Logout</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 22,
    backgroundColor: "#071B3A",
  },

  header: {
    color: "white",
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 20,
  },

  profileCard: {
    backgroundColor: "#0B1220",
    padding: 16,
    borderRadius: 14,
    marginBottom: 22,
  },

  profileName: {
    color: "white",
    fontSize: 18,
    fontWeight: "800",
  },

  profileRole: {
    color: "#9FB4D9",
    marginTop: 4,
  },

  section: {
    color: "#9FB4D9",
    marginBottom: 10,
  },

  selector: {
    backgroundColor: "#0B1220",
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },

  selectorLabel: {
    color: "#7f8fb3",
    fontSize: 12,
  },

  selectorValue: {
    color: "white",
    fontWeight: "800",
    marginTop: 2,
  },

  toggleRow: {
    flexDirection: "row",
    marginTop: 10,
    gap: 10,
  },

  toggle: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#0B1220",
    alignItems: "center",
  },

  toggleActive: {
    backgroundColor: "#2563EB",
  },

  toggleText: {
    color: "white",
    fontWeight: "800",
  },

  scanButton: {
    backgroundColor: "#22C55E",
    padding: 18,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 20,
  },

  scanText: {
    color: "#071B3A",
    fontWeight: "900",
    fontSize: 16,
  },

  logoutBtn: {
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#1e293b",
    alignItems: "center",
  },

  logoutText: {
    color: "white",
    fontWeight: "700",
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 20,
  },

  modalCard: {
    backgroundColor: "#0B1220",
    borderRadius: 14,
    padding: 18,
    maxHeight: "70%",
  },

  modalTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 10,
  },

  modalItem: {
    padding: 12,
  },

  modalItemText: {
    color: "white",
  },

  modalClose: {
    marginTop: 10,
    backgroundColor: "#ef4444",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },

  modalCloseText: {
    color: "white",
    fontWeight: "700",
  },
});
