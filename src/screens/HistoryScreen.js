import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  Modal,
} from "react-native";
import { getHistory, clearHistory } from "../storage/scans";
import { useRole } from "../context/RoleContext";

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
    item?.data?.org ||
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
  const base = `${item.direction} · ${item.time_label || ""}`.trim();
  return who ? `${who}\n${base}` : base;
}

export default function HistoryScreen() {
  const { role } = useRole();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);

  const load = async () => {
    const list = await getHistory();
    setItems(list);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const qq = (q || "").trim().toLowerCase();
    if (!qq) return items;

    return items.filter((it) => {
      const hay =
        `${it.qr_code || ""} ${getName(it)} ${getCompany(it)} ${it.direction || ""} ${it.status || ""}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [items, q]);

  return (
    <View className="flex-1 bg-[#0B1220] p-4">
      <Text className="text-white text-lg font-black mb-3">Scan History</Text>

      {/* Search */}
      <View className="flex-row gap-2 mb-3">
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search name, company, QR, status…"
          placeholderTextColor="rgba(255,255,255,0.45)"
          className="flex-1 h-11 px-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold"
        />

        <Pressable
          onPress={load}
          className="h-11 px-4 rounded-xl bg-white/10 items-center justify-center"
        >
          <Text className="text-white font-black">Refresh</Text>
        </Pressable>
      </View>

      {/* Admin Clear */}
      {role === "ADMIN" && (
        <Pressable
          onPress={async () => {
            await clearHistory();
            await load();
          }}
          className="h-11 px-4 rounded-xl bg-white/10 items-center justify-center mb-3 self-start"
        >
          <Text className="text-white font-black">Clear history</Text>
        </Pressable>
      )}

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setSelected(item)}
            className="bg-white/5 rounded-2xl p-3 mb-2 border border-white/10"
          >
            <View className="flex-row items-center justify-between gap-2">
              <View className="flex-1">
                <Text
                  className="text-white font-black text-[15px]"
                  numberOfLines={1}
                >
                  {getName(item) || "Unknown Guest"}
                </Text>

                {!!getCompany(item) && (
                  <Text
                    className="text-white/60 text-xs font-bold mt-1"
                    numberOfLines={1}
                  >
                    {getCompany(item)}
                  </Text>
                )}
              </View>

              <Text
                className={`text-white font-black text-xs px-3 py-1 rounded-full ${
                  item.status === "SUCCESS"
                    ? "bg-green-400/20"
                    : item.status === "FAIL"
                      ? "bg-red-400/20"
                      : item.status === "OFFLINE_SAVED"
                        ? "bg-blue-400/20"
                        : "bg-white/10"
                }`}
              >
                {item.status === "OFFLINE_SAVED" ? "OFFLINE" : item.status}
              </Text>
            </View>

            <Text className="text-white/85 mt-2 font-bold leading-5">
              {formatLine(item)}
            </Text>

            {!!item.message && (
              <Text className="text-white/60 mt-1 font-semibold">
                {item.message}
              </Text>
            )}
          </Pressable>
        )}
        ListEmptyComponent={
          <Text className="text-white/70 mt-6">No history yet.</Text>
        }
      />

      {/* Modal */}
      <Modal visible={!!selected} transparent animationType="fade">
        <Pressable
          onPress={() => setSelected(null)}
          className="flex-1 bg-black/60 justify-center p-4"
        >
          <Pressable className="bg-[#101A33] rounded-2xl border border-white/10 p-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-white text-base font-black">
                Member Details
              </Text>

              <Pressable
                onPress={() => setSelected(null)}
                className="w-9 h-9 rounded-xl bg-white/10 items-center justify-center"
              >
                <Text className="text-white font-black">✕</Text>
              </Pressable>
            </View>

            <View className="bg-white/5 rounded-xl p-3 border border-white/10 mt-2">
              <Text className="text-white font-black text-base">
                {getName(selected) || "Unknown Guest"}
              </Text>

              {!!getCompany(selected) && (
                <Text className="text-white/70 mt-1 font-bold">
                  {getCompany(selected)}
                </Text>
              )}

              {!!getDesignation(selected) && (
                <Text className="text-white/60 mt-1 font-bold">
                  {getDesignation(selected)}
                </Text>
              )}
            </View>

            {!!selected?.message && (
              <View className="bg-white/5 rounded-xl p-3 border border-white/10 mt-2">
                <Text className="text-white/85 font-bold leading-5">
                  {selected.message}
                </Text>
              </View>
            )}

            <View className="flex-row justify-end mt-3">
              <Pressable
                onPress={() => setSelected(null)}
                className="h-11 px-4 rounded-xl bg-white/10 items-center justify-center"
              >
                <Text className="text-white font-black">Close</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
