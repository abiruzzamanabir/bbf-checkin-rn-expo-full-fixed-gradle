import { api } from "./client";
import AsyncStorage from "@react-native-async-storage/async-storage";

const GATES_KEY = "bbf_gates";

/* ---------------- FETCH GATES ---------------- */

export async function fetchGates(event_slug) {
  try {
    const res = await api.get("/gates", {
      params: { event_slug },
    });

    const gates = res?.data?.gates;

    if (!Array.isArray(gates)) return [];

    // ✅ Normalize + clean
    const cleaned = gates.map((g) => ({
      id: g.id,
      name: g.name,
      code: g.code,
      is_active: !!g.is_active,
    }));

    // ✅ Cache per event
    await AsyncStorage.setItem(
      `${GATES_KEY}_${event_slug}`,
      JSON.stringify(cleaned),
    );

    return cleaned;
  } catch (error) {
    /* -------- OFFLINE FALLBACK -------- */
    const cached = await AsyncStorage.getItem(`${GATES_KEY}_${event_slug}`);

    if (cached) {
      // console.log("Using cached gates");
      return JSON.parse(cached);
    }

    /* -------- LOG ERROR -------- */
    if (!error.response) {
      // console.log("Offline → no cached gates");
    } else {
      // console.log("Gates API error:", error.response.status);
    }

    return [];
  }
}
