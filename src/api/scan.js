import Constants from "expo-constants";
import { api } from "./client";

/**
 * Laravel expects:
 *  - event_slug (required)
 *  - direction (required) IN|OUT
 *  - qr_code OR token (we send qr_code)
 *  - gate_code (optional)
 *  - device_uuid (optional)
 */
export async function submitScan({ qr_code, event_slug, direction, gate_code, device_uuid }) {
  const path = Constants.expoConfig?.extra?.SCAN_PATH || "/scan";
  const payload = { event_slug, direction, qr_code };
  if (gate_code) payload.gate_code = gate_code;
  if (device_uuid) payload.device_uuid = device_uuid;

  const res = await api.post(path, payload);
  return res.data;
}
