import Constants from "expo-constants";
import { api } from "./client";

/**
 * Laravel expects:
 *  - event_slug (required)
 *  - direction (required) IN|OUT
 *  - qr_code OR token
 *  - gate_id (required)
 *  - device_uuid (optional)
 */
export async function submitScan({
  qr_code,
  event_slug,
  direction,
  gate_id,
  device_uuid,
}) {
  const path = Constants.expoConfig?.extra?.SCAN_PATH || "/scan";

  const payload = {
    event_slug,
    direction,
    qr_code,
    gate_id, // ✅ FIXED (THIS IS THE KEY)
  };

  if (device_uuid) payload.device_uuid = device_uuid;

  // console.log("API PAYLOAD:", payload); // 🔍 debug

  const res = await api.post(path, payload);
  return res.data;
}
