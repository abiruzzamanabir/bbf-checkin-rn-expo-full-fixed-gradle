import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  Pressable,
  Modal,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { getHistory, clearHistory } from "../storage/scans";
import { useRole } from "../context/RoleContext";

function getQR(item) {
  if (!item) return "";

  return (
    item.qr_code ||
    item.qr ||
    item.code ||
    item.ticket_code ||
    item.qrCode ||
    item.data?.qr_code ||
    item.data?.qr ||
    item.data?.code ||
    item.data?.ticket_code ||
    ""
  );
}

function getTime(item) {
  return item?.time_label || item?.time || item?.data?.time_label || "";
}

function getName(item) {
  return (
    item?.name ||
    item?.full_name ||
    item?.member_name ||
    item?.attendee_name ||
    item?.visitor_name ||
    item?.profile?.name ||
    item?.user?.name ||
    item?.data?.name ||
    ""
  );
}

function getCompany(item) {
  return (
    item?.company ||
    item?.company_name ||
    item?.organization ||
    item?.org ||
    item?.org_name ||
    item?.profile?.company ||
    item?.user?.company ||
    item?.data?.company ||
    item?.data?.organization ||
    ""
  );
}

function getDesignation(item) {
  return (
    item?.designation ||
    item?.title ||
    item?.role ||
    item?.profile?.designation ||
    item?.user?.designation ||
    item?.data?.designation ||
    ""
  );
}

function formatLine(item) {
  const name = getName(item);
  const company = getCompany(item);

  const who = name ? `${name}${company ? ` · ${company}` : ""}` : "";

  const base = `${item.gate || "Gate"} · ${item.direction || ""} · ${
    item.time_label || ""
  }`;

  return who ? `${who}\n${base}` : base;
}

export default function HistoryScreen() {
  const { role } = useRole();

  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);

  const load = async () => {
    const list = await getHistory();
    setItems(list || []);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return items;

    return items.filter((it) => {
      const hay = `
      ${getQR(it)}
      ${getName(it)}
      ${getCompany(it)}
      ${it.direction || ""}
      ${it.status || ""}
    `.toLowerCase();

      return hay.includes(qq);
    });
  }, [items, q]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Scan History</Text>

      <View style={styles.searchRow}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search name, company, QR..."
          placeholderTextColor="rgba(255,255,255,0.45)"
          style={styles.search}
        />

        <Pressable style={styles.btn} onPress={load}>
          <Text style={styles.btnText}>Refresh</Text>
        </Pressable>
      </View>

      {role === "ADMIN" && (
        <Pressable
          style={[styles.btn, { marginBottom: 10 }]}
          onPress={async () => {
            await clearHistory();
            await load();
          }}
        >
          <Text style={styles.btnText}>Clear History</Text>
        </Pressable>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(it, i) => String(it.id ?? i)}
        contentContainerStyle={{ paddingBottom: 30 }}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => {
              console.log("SCAN ITEM:", item);
              setSelected(item);
            }}
          >
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {getName(item) || "Unknown Guest"}
                </Text>

                {!!getCompany(item) && (
                  <Text style={styles.company}>{getCompany(item)}</Text>
                )}
              </View>

              <Text style={[styles.badge, badgeStyle(item.status)]}>
                {item.status === "OFFLINE_SAVED" ? "OFFLINE" : item.status}
              </Text>
            </View>

            <Text style={styles.line}>{formatLine(item)}</Text>

            {!!item.message && <Text style={styles.sub}>{item.message}</Text>}
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No scan history yet</Text>
        }
      />

      {/* DETAIL MODAL */}

      <Modal
        visible={!!selected}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Member Details</Text>

            <Text style={styles.modalName}>{getName(selected || {})}</Text>

            {!!getCompany(selected || {}) && (
              <Text style={styles.modalCompany}>{getCompany(selected)}</Text>
            )}

            {!!getDesignation(selected || {}) && (
              <Text style={styles.modalMeta}>{getDesignation(selected)}</Text>
            )}

            {/* QR BIG DISPLAY */}

            <View style={styles.qrBox}>
              <Text style={styles.qrLabel}>QR CODE</Text>
              <Text style={styles.qrValue}>
                {getQR(selected) || "QR Not Available"}
              </Text>

              <Pressable
                style={styles.copyBtn}
                onPress={() => {
                  const qr = getQR(selected);
                  if (qr) Clipboard.setStringAsync(qr);
                }}
              >
                <Text style={styles.copyText}>Copy</Text>
              </Pressable>
            </View>

            <View style={styles.modalSection}>
              <DetailRow label="Gate" value={selected?.gate} />
              <DetailRow label="Direction" value={selected?.direction} />
              <DetailRow label="Time" value={getTime(selected)} />
              <DetailRow label="Status" value={selected?.status} />
            </View>

            {!!selected?.message && (
              <Text style={styles.modalMessage}>{selected.message}</Text>
            )}

            <Pressable
              style={styles.modalBtn}
              onPress={() => setSelected(null)}
            >
              <Text style={styles.modalBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DetailRow({ label, value }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || "—"}</Text>
    </View>
  );
}

function badgeStyle(status) {
  if (status === "SUCCESS") return styles.success;
  if (status === "FAIL") return styles.fail;
  if (status === "OFFLINE_SAVED") return styles.offline;

  return styles.neutral;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1220",
    padding: 14,
  },

  title: {
    color: "white",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 10,
  },

  searchRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },

  search: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "white",
  },

  btn: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },

  btnText: {
    color: "white",
    fontWeight: "800",
  },

  card: {
    backgroundColor: "#111A2F",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  name: {
    color: "white",
    fontWeight: "900",
  },

  company: {
    color: "#9FB4D9",
    fontSize: 12,
  },

  badge: {
    fontWeight: "800",
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },

  success: { backgroundColor: "#16A34A" },
  fail: { backgroundColor: "#DC2626" },
  offline: { backgroundColor: "#3B82F6" },
  neutral: { backgroundColor: "#475569" },

  line: {
    color: "white",
    marginTop: 8,
  },

  sub: {
    color: "#94A3B8",
    marginTop: 4,
  },

  empty: {
    color: "#94A3B8",
    marginTop: 20,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 20,
  },

  modalCard: {
    backgroundColor: "#0F172A",
    padding: 20,
    borderRadius: 16,
  },

  modalTitle: {
    color: "white",
    fontWeight: "900",
    fontSize: 18,
  },

  modalName: {
    color: "white",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 10,
  },

  modalCompany: {
    color: "#94A3B8",
  },

  modalMeta: {
    color: "#94A3B8",
  },

  modalSection: {
    marginTop: 14,
  },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  detailLabel: {
    color: "#94A3B8",
  },

  detailValue: {
    color: "white",
  },

  modalMessage: {
    marginTop: 12,
    color: "#CBD5F5",
  },

  modalBtn: {
    marginTop: 14,
    backgroundColor: "#2563EB",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },

  modalBtnText: {
    color: "white",
    fontWeight: "800",
  },
  qrBox: {
    backgroundColor: "#020617",
    padding: 16,
    borderRadius: 12,
    marginTop: 14,
    alignItems: "center",
  },

  qrLabel: {
    color: "#64748B",
    fontSize: 12,
  },

  qrValue: {
    color: "white",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 6,
  },

  copyBtn: {
    marginTop: 10,
    backgroundColor: "#2563EB",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },

  copyText: {
    color: "white",
    fontWeight: "700",
  },
});
