import React, { useEffect, useRef, useState } from "react";

import {
  View,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
  Modal,
  Dimensions,
} from "react-native";

import {
  Text,
  TextInput,
  Provider as PaperProvider,
  MD3DarkTheme,
} from "react-native-paper";

import { SafeAreaView } from "react-native-safe-area-context";

import { LinearGradient } from "expo-linear-gradient";

import { BlurView } from "expo-blur";

import * as Device from "expo-device";

import {
  QrCode,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Smartphone,
  ShieldCheck,
  Fingerprint,
  ChevronRight,
  TriangleAlert,
  Activity,
  ScanFace,
  Sparkles,
} from "lucide-react-native";

import { login } from "../api/auth";

import { setToken } from "../storage/token";

const { width } = Dimensions.get("window");

const theme = {
  ...MD3DarkTheme,

  colors: {
    ...MD3DarkTheme.colors,

    primary: "#3B82F6",

    background: "#020617",

    surface: "#0F172A",
  },
};

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [deviceName, setDeviceName] = useState("");

  const [secure, setSecure] = useState(true);

  const [loading, setLoading] = useState(false);

  const [errorModal, setErrorModal] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const slideAnim = useRef(new Animated.Value(50)).current;

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),

      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.06,
          duration: 1400,
          useNativeDriver: true,
        }),

        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  useEffect(() => {
    async function loadDevice() {
      try {
        const brand = Device.brand || "";

        const model = Device.modelName || "";

        setDeviceName(`${brand} ${model}`.trim());
      } catch {
        setDeviceName("Unknown Device");
      }
    }

    loadDevice();
  }, []);

  async function onLogin() {
    if (!email || !password) {
      setErrorMessage("Please enter your email and password.");

      setErrorModal(true);

      return;
    }

    try {
      setLoading(true);

      const data = await login({
        email,
        password,
        device_name: deviceName,
      });

      await setToken(data.token);

      navigation.replace("Main");
    } catch (e) {
      const msg = e?.response?.data?.message || "Invalid email or password.";

      setErrorMessage(msg);

      setErrorModal(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PaperProvider theme={theme}>
      <SafeAreaView style={styles.safe}>
        <LinearGradient
          colors={["#020617", "#071226", "#0F172A"]}
          style={styles.container}
        >
          <StatusBar barStyle="light-content" />

          <View style={styles.glow1} />

          <View style={styles.glow2} />

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scroll}
            >
              <Animated.View
                style={{
                  opacity: fadeAnim,

                  transform: [
                    {
                      translateY: slideAnim,
                    },
                  ],
                }}
              >
                <View style={styles.topHeader}>
                  <Animated.View
                    style={{
                      transform: [
                        {
                          scale: pulseAnim,
                        },
                      ],
                    }}
                  >
                    <LinearGradient
                      colors={["#2563EB", "#1D4ED8"]}
                      style={styles.logoWrap}
                    >
                      <QrCode size={54} color="#FFFFFF" />
                    </LinearGradient>
                  </Animated.View>

                  <Text style={styles.brand}>BBF CHECK-IN</Text>

                  <Text style={styles.subtitle}>
                    Enterprise Event Intelligence Platform
                  </Text>

                  <BlurView intensity={25} tint="dark" style={styles.liveBadge}>
                    <Activity size={14} color="#22C55E" />

                    <Text style={styles.liveText}>SYSTEM ONLINE</Text>
                  </BlurView>
                </View>

                <BlurView intensity={40} tint="dark" style={styles.card}>
                  <View style={styles.cardTop}>
                    <View>
                      <Text style={styles.cardTitle}>Scanner Access</Text>

                      <Text style={styles.cardDesc}>
                        Secure authentication for scanner operations and live
                        attendee validation.
                      </Text>
                    </View>

                    <LinearGradient
                      colors={["#172554", "#1E293B"]}
                      style={styles.sparkWrap}
                    >
                      <Sparkles size={22} color="#60A5FA" />
                    </LinearGradient>
                  </View>

                  {/* EMAIL */}

                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>

                    <LinearGradient
                      colors={[
                        "rgba(255,255,255,0.07)",
                        "rgba(255,255,255,0.03)",
                      ]}
                      style={styles.inputBox}
                    >
                      <View style={styles.iconWrap}>
                        <Mail size={18} color="#60A5FA" />
                      </View>

                      <TextInput
                        mode="flat"
                        value={email}
                        onChangeText={setEmail}
                        placeholder="scanner@bbf.com"
                        placeholderTextColor="#475569"
                        autoCapitalize="none"
                        style={styles.premiumInput}
                        underlineColor="transparent"
                        activeUnderlineColor="transparent"
                        cursorColor="#3B82F6"
                        theme={{
                          colors: {
                            text: "#FFFFFF",
                            primary: "#3B82F6",
                            background: "transparent",
                          },
                        }}
                      />
                    </LinearGradient>
                  </View>

                  {/* PASSWORD */}

                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>PASSWORD</Text>

                    <LinearGradient
                      colors={[
                        "rgba(255,255,255,0.07)",
                        "rgba(255,255,255,0.03)",
                      ]}
                      style={styles.inputBox}
                    >
                      <View style={styles.iconWrap}>
                        <Lock size={18} color="#60A5FA" />
                      </View>

                      <TextInput
                        mode="flat"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={secure}
                        placeholder="Enter password"
                        placeholderTextColor="#475569"
                        style={styles.premiumInput}
                        underlineColor="transparent"
                        activeUnderlineColor="transparent"
                        cursorColor="#3B82F6"
                        theme={{
                          colors: {
                            text: "#FFFFFF",
                            primary: "#3B82F6",
                            background: "transparent",
                          },
                        }}
                      />

                      <TouchableOpacity
                        style={styles.eyeWrap}
                        onPress={() => setSecure(!secure)}
                      >
                        {secure ? (
                          <EyeOff size={18} color="#64748B" />
                        ) : (
                          <Eye size={18} color="#64748B" />
                        )}
                      </TouchableOpacity>
                    </LinearGradient>
                  </View>

                  {/* DEVICE */}

                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>SCANNER DEVICE</Text>

                    <LinearGradient
                      colors={[
                        "rgba(255,255,255,0.05)",
                        "rgba(255,255,255,0.02)",
                      ]}
                      style={styles.inputBox}
                    >
                      <View style={styles.iconWrap}>
                        <Smartphone size={18} color="#22C55E" />
                      </View>

                      <View style={styles.deviceReadonly}>
                        <Text
                          numberOfLines={1}
                          style={styles.deviceReadonlyText}
                        >
                          {deviceName || "Unknown Device"}
                        </Text>
                      </View>
                    </LinearGradient>
                  </View>

                  {/* LOGIN */}

                  <TouchableOpacity
                    activeOpacity={0.92}
                    onPress={onLogin}
                    disabled={loading}
                  >
                    <LinearGradient
                      colors={["#2563EB", "#1D4ED8", "#1E40AF"]}
                      style={styles.loginBtn}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <>
                          <Text style={styles.loginText}>LOGIN TO SYSTEM</Text>

                          <ChevronRight size={20} color="#FFFFFF" />
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* REGISTER */}

                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => navigation.navigate("Register")}
                    style={styles.registerBtn}
                  >
                    <ScanFace size={18} color="#60A5FA" />

                    <Text style={styles.registerText}>
                      CREATE SCANNER ACCOUNT
                    </Text>
                  </TouchableOpacity>

                  {/* SECURITY */}

                  <View style={styles.securityRow}>
                    <BlurView
                      intensity={30}
                      tint="dark"
                      style={styles.securityCard}
                    >
                      <ShieldCheck size={16} color="#22C55E" />

                      <Text style={styles.securityText}>Secure Access</Text>
                    </BlurView>

                    <BlurView
                      intensity={30}
                      tint="dark"
                      style={styles.securityCard}
                    >
                      <Fingerprint size={16} color="#60A5FA" />

                      <Text style={styles.securityText}>Biometrics</Text>
                    </BlurView>
                  </View>
                </BlurView>

                <Text style={styles.footer}>Bangladesh Brand Forum</Text>
              </Animated.View>
            </ScrollView>
          </KeyboardAvoidingView>

          {/* ERROR MODAL */}

          <Modal visible={errorModal} transparent animationType="fade">
            <View style={styles.modalBackdrop}>
              <BlurView intensity={45} tint="dark" style={styles.modalCard}>
                <LinearGradient
                  colors={["#DC2626", "#B91C1C"]}
                  style={styles.modalIcon}
                >
                  <TriangleAlert size={40} color="#FFFFFF" />
                </LinearGradient>

                <Text style={styles.modalTitle}>Login Failed</Text>

                <Text style={styles.modalMessage}>{errorMessage}</Text>

                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => setErrorModal(false)}
                >
                  <LinearGradient
                    colors={["#2563EB", "#1D4ED8"]}
                    style={styles.modalBtn}
                  >
                    <Text style={styles.modalBtnText}>TRY AGAIN</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </BlurView>
            </View>
          </Modal>
        </LinearGradient>
      </SafeAreaView>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#020617",
  },

  container: {
    flex: 1,
  },

  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 22,
    paddingVertical: 40,
  },

  glow1: {
    position: "absolute",
    width: 340,
    height: 340,
    borderRadius: 999,
    backgroundColor: "rgba(37,99,235,0.20)",
    top: -120,
    right: -80,
  },

  glow2: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.10)",
    bottom: -60,
    left: -60,
  },

  topHeader: {
    alignItems: "center",
    marginBottom: 32,
  },

  logoWrap: {
    width: 118,
    height: 118,
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 22,
  },

  brand: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  subtitle: {
    color: "#94A3B8",
    marginTop: 10,
    textAlign: "center",
    fontSize: 14,
  },

  liveBadge: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    overflow: "hidden",
  },

  liveText: {
    color: "#22C55E",
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 1,
  },

  card: {
    borderRadius: 34,
    overflow: "hidden",
    padding: 24,
    backgroundColor: "rgba(15,23,42,0.76)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },

  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
  },

  cardTitle: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900",
  },

  cardDesc: {
    color: "#94A3B8",
    marginTop: 8,
    lineHeight: 22,
    width: width * 0.54,
  },

  sparkWrap: {
    width: 58,
    height: 58,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },

  fieldContainer: {
    marginBottom: 18,
  },

  fieldLabel: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
    marginBottom: 10,
    marginLeft: 4,
  },

  inputBox: {
    height: 66,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },

  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  premiumInput: {
    flex: 1,
    backgroundColor: "transparent",
    color: "#FFFFFF",
    fontSize: 15,
  },

  eyeWrap: {
    padding: 6,
    marginLeft: 10,
  },

  deviceReadonly: {
    flex: 1,
    justifyContent: "center",
  },

  deviceReadonlyText: {
    color: "#94A3B8",
    fontSize: 15,
    fontWeight: "700",
  },

  loginBtn: {
    height: 64,
    borderRadius: 22,
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },

  loginText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 1,
  },

  registerBtn: {
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    backgroundColor: "rgba(59,130,246,0.08)",
    flexDirection: "row",
    gap: 10,
  },

  registerText: {
    color: "#60A5FA",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  securityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 22,
    gap: 12,
  },

  securityCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 18,
    overflow: "hidden",
  },

  securityText: {
    color: "#CBD5E1",
    fontWeight: "700",
  },

  footer: {
    marginTop: 28,
    textAlign: "center",
    color: "#475569",
    fontWeight: "700",
    fontSize: 13,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },

  modalCard: {
    width: "100%",
    borderRadius: 34,
    overflow: "hidden",
    padding: 28,
    alignItems: "center",
    backgroundColor: "rgba(15,23,42,0.92)",
  },

  modalIcon: {
    width: 84,
    height: 84,
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 22,
  },

  modalTitle: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 12,
  },

  modalMessage: {
    color: "#CBD5E1",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },

  modalBtn: {
    width: 220,
    height: 56,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },

  modalBtnText: {
    color: "#FFFFFF",
    fontWeight: "900",
    letterSpacing: 1,
  },
});
