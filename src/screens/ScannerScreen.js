import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, Animated, Easing } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { BlurView } from "expo-blur";
import * as Network from "expo-network";
import * as Device from "expo-device";
import { Audio } from "expo-av";

import { submitScan } from "../api/scan";
import { fetchEventStats } from "../api/stats";
import {
  enqueueOfflineScan,
  getOfflineQueue,
  setOfflineQueue,
} from "../storage/scans";

const QR_LEAVE_MS = 650;
const SCAN_COOLDOWN = 700;

export default function ScannerScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();

  const [cameraType, setCameraType] = useState("back");
  const [flash, setFlash] = useState("off");
  const [online, setOnline] = useState(true);

  const [insideCount, setInsideCount] = useState(0);
  const [outsideCount, setOutsideCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [scanState, setScanState] = useState("SEARCHING");
  const [scanLocked, setScanLocked] = useState(false);

  const processingRef = useRef(false);
  const lastQrRef = useRef(null);
  const lastScanTimeRef = useRef(0);
  const qrLeaveTimerRef = useRef(null);

  const scanLineY = useRef(new Animated.Value(0)).current;

  const inSoundRef = useRef(null);
  const outSoundRef = useRef(null);
  const failSoundRef = useRef(null);

  const direction = "IN";

  useEffect(() => {
    (async () => {
      inSoundRef.current = (
        await Audio.Sound.createAsync(require("../../assets/sounds/in.wav"))
      ).sound;

      outSoundRef.current = (
        await Audio.Sound.createAsync(require("../../assets/sounds/out.wav"))
      ).sound;

      failSoundRef.current = (
        await Audio.Sound.createAsync(require("../../assets/sounds/fail.wav"))
      ).sound;
    })();

    return () => {
      inSoundRef.current?.unloadAsync();
      outSoundRef.current?.unloadAsync();
      failSoundRef.current?.unloadAsync();
    };
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineY, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineY, {
          toValue: 0,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  useEffect(() => {
    const check = async () => {
      const st = await Network.getNetworkStateAsync();
      setOnline(!!st.isConnected);
      if (st.isConnected) syncOfflineQueue();
    };

    check();
    const id = setInterval(check, 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    refreshStats();
  }, [online]);

  async function refreshStats() {
    try {
      const d = await fetchEventStats();
      setInsideCount(d?.inside_count ?? 0);
      setOutsideCount(d?.outside_count ?? 0);
      setTotalCount(d?.total ?? 0);
    } catch {}
  }

  async function playSound(ok) {
    try {
      if (!ok) return failSoundRef.current?.replayAsync();
      return inSoundRef.current?.replayAsync();
    } catch {}
  }

  function lockUntilQrLeaves() {
    setScanLocked(true);

    clearTimeout(qrLeaveTimerRef.current);

    qrLeaveTimerRef.current = setTimeout(() => {
      lastQrRef.current = null;
      setScanLocked(false);
      setScanState("SEARCHING");
    }, QR_LEAVE_MS);
  }

  async function onScanPayload(qr_code) {
    if (!qr_code || scanLocked || processingRef.current) return;

    if (lastQrRef.current === qr_code) {
      lockUntilQrLeaves();
      return;
    }

    processingRef.current = true;
    lastQrRef.current = qr_code;
    setScanState("VALIDATING");

    const payload = {
      qr_code,
      direction,
      device_uuid: Device.modelId || "mobile",
    };

    try {
      if (!online) throw new Error("OFFLINE");

      const res = await submitScan(payload);
      const ok = res?.status === "OK";

      await playSound(ok);

      setScanState(ok ? "SUCCESS" : "FAIL");

      refreshStats();
    } catch {
      await enqueueOfflineScan(payload);
      setScanState("OFFLINE");
    } finally {
      processingRef.current = false;
      lockUntilQrLeaves();
    }
  }

  const onBarcodeScanned = ({ data }) => {
    const now = Date.now();

    if (now - lastScanTimeRef.current < SCAN_COOLDOWN) return;

    lastScanTimeRef.current = now;

    const qr = String(data?.data ?? data?.rawValue ?? "").trim();

    if (qr) onScanPayload(qr);
  };

  async function syncOfflineQueue() {
    const q = await getOfflineQueue();

    if (!q.length) return;

    for (const item of q) {
      try {
        await submitScan(item);
      } catch {
        return;
      }
    }

    await setOfflineQueue([]);
  }

  const toggleCamera = () =>
    setCameraType((p) => (p === "back" ? "front" : "back"));

  const toggleFlash = () => setFlash((p) => (p === "off" ? "on" : "off"));

  const statusText = useMemo(() => {
    if (scanState === "SEARCHING") return "Looking for QR";
    if (scanState === "VALIDATING") return "Validating…";
    if (scanState === "SUCCESS") return "Recorded";
    if (scanState === "OFFLINE") return "Saved offline";

    return "Failed";
  }, [scanState]);

  if (!permission) return <View className="flex-1 bg-[#0B1220]" />;

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-[#0B1220]">
        <Text className="text-white mb-3">Camera permission required</Text>

        <Pressable
          onPress={requestPermission}
          className="bg-[#79C2FF] px-4 py-3 rounded-xl"
        >
          <Text className="font-black">Allow Camera</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#0B1220]">
      <Text className="text-white text-lg font-black p-4">Scan QR</Text>

      <View className="px-4">
        <Text className="text-white mb-1">Inside: {insideCount}</Text>

        <Text className="text-white mb-1">Outside: {outsideCount}</Text>

        <Text className="text-white">Total: {totalCount}</Text>
      </View>

      <View className="flex-1 m-4 rounded-2xl overflow-hidden">
        <CameraView
          style={{ flex: 1 }}
          facing={cameraType}
          enableTorch={flash === "on"}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={onBarcodeScanned}
        />

        <BlurView
          intensity={15}
          tint="dark"
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />

        <View className="absolute top-4 right-4 gap-2">
          <Pressable
            onPress={toggleCamera}
            className="bg-black/60 px-3 py-2 rounded-xl"
          >
            <Text className="text-white font-black text-xs">
              {cameraType === "back" ? "Front" : "Back"}
            </Text>
          </Pressable>

          <Pressable
            onPress={toggleFlash}
            className="bg-black/60 px-3 py-2 rounded-xl"
          >
            <Text className="text-white font-black text-xs">
              Flash {flash === "on" ? "ON" : "OFF"}
            </Text>
          </Pressable>
        </View>

        <Animated.View
          className="absolute left-5 right-5 h-[2px] bg-[#79C2FF]"
          style={{
            transform: [
              {
                translateY: scanLineY.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 250],
                }),
              },
            ],
          }}
        />
      </View>

      <Text className="text-white text-center p-4 font-black">
        {statusText}
      </Text>
    </View>
  );
}
