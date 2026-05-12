import React, { useEffect, useState } from "react";

import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Modal,
  ActivityIndicator,
} from "react-native";

import { Text, TextInput } from "react-native-paper";

import { SafeAreaView } from "react-native-safe-area-context";

import { LinearGradient } from "expo-linear-gradient";

import {
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowLeft,
  CheckCircle2,
  TriangleAlert,
  Laptop,
  Sparkles,
} from "lucide-react-native";

import * as Device from "expo-device";

import { registerUser } from "../api/auth";

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState("");

  const [email, setEmail] = useState("");

  const [phone, setPhone] = useState("");

  const [deviceName, setDeviceName] = useState("");

  const [password, setPassword] = useState("");

  const [confirmPassword, setConfirmPassword] = useState("");

  const [secure, setSecure] = useState(true);

  const [confirmSecure, setConfirmSecure] = useState(true);

  const [loading, setLoading] = useState(false);

  const [modal, setModal] = useState({
    visible: false,
    type: "success",
    title: "",
    message: "",
  });

  useEffect(() => {
    loadDeviceName();
  }, []);

  async function loadDeviceName() {
    try {
      const brand = Device.brand || "";

      const model = Device.modelName || "";

      const device =
        Device.deviceName || `${brand} ${model}`.trim() || "Unknown Device";

      setDeviceName(device);
    } catch {
      setDeviceName("Unknown Device");
    }
  }

  function showModal(type, title, message) {
    setModal({
      visible: true,
      type,
      title,
      message,
    });
  }

  async function onRegister() {
    if (!name.trim() || !email.trim() || !phone.trim() || !password) {
      showModal(
        "error",
        "Missing Information",
        "Please fill all required fields.",
      );

      return;
    }

    if (password.length < 6) {
      showModal(
        "error",
        "Weak Password",
        "Password must be at least 6 characters.",
      );

      return;
    }

    if (password !== confirmPassword) {
      showModal(
        "error",
        "Password Mismatch",
        "Password and confirm password do not match.",
      );

      return;
    }

    try {
      setLoading(true);

      await registerUser({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        password_confirmation: confirmPassword,
        device_name: deviceName,
      });

      showModal(
        "success",
        "Registration Submitted",
        "Your scanner account has been created successfully. Please wait for admin approval before login.",
      );
    } catch (e) {
      showModal(
        "error",
        "Registration Failed",
        e?.response?.data?.message || "Could not create scanner account.",
      );
    } finally {
      setLoading(false);
    }
  }

  function closeModal() {
    const wasSuccess = modal.type === "success";

    setModal({
      ...modal,
      visible: false,
    });

    if (wasSuccess) {
      navigation.replace("Login");
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />

      <LinearGradient
        colors={["#020617", "#071226", "#0F172A"]}
        style={styles.container}
      >
        <View style={styles.glowOne} />

        <View style={styles.glowTwo} />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scroll}
          >
            <View style={styles.header}>
              <LinearGradient
                colors={["#2563EB", "#1D4ED8"]}
                style={styles.logo}
              >
                <ShieldCheck size={48} color="#FFFFFF" />
              </LinearGradient>

              <Text style={styles.title}>Scanner Registration</Text>

              <Text style={styles.subtitle}>
                Create secure scanner access for event operations.
              </Text>
            </View>

            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View>
                  <Text style={styles.cardTitle}>Create Account</Text>

                  <Text style={styles.cardDesc}>
                    Register a scanner account for secure attendee validation.
                  </Text>
                </View>

                <LinearGradient
                  colors={["#172554", "#1E293B"]}
                  style={styles.sparkWrap}
                >
                  <Sparkles size={20} color="#60A5FA" />
                </LinearGradient>
              </View>

              <Field
                label="FULL NAME"
                icon={<User size={18} color="#60A5FA" />}
                value={name}
                onChangeText={setName}
                placeholder="Enter full name"
              />

              <Field
                label="EMAIL ADDRESS"
                icon={<Mail size={18} color="#60A5FA" />}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter email address"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Field
                label="PHONE NUMBER"
                icon={<Phone size={18} color="#60A5FA" />}
                value={phone}
                onChangeText={setPhone}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
              />

              <ReadonlyField
                label="SCANNER DEVICE"
                icon={<Laptop size={18} color="#22C55E" />}
                value={deviceName}
              />

              <PasswordField
                label="PASSWORD"
                value={password}
                onChangeText={setPassword}
                secure={secure}
                setSecure={setSecure}
                placeholder="Create password"
              />

              <PasswordField
                label="CONFIRM PASSWORD"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secure={confirmSecure}
                setSecure={setConfirmSecure}
                placeholder="Confirm password"
              />

              <TouchableOpacity
                activeOpacity={0.92}
                onPress={onRegister}
                disabled={loading}
              >
                <LinearGradient
                  colors={["#2563EB", "#1D4ED8", "#1E40AF"]}
                  style={styles.submitBtn}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitText}>SUBMIT REGISTRATION</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => navigation.replace("Login")}
                style={styles.backToLoginBtn}
              >
                <ArrowLeft size={18} color="#BFDBFE" />

                <Text style={styles.backToLoginText}>BACK TO LOGIN</Text>
              </TouchableOpacity>

              <Text style={styles.note}>
                After submission, admin approval is required before scanner
                access is activated.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        <Modal visible={modal.visible} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <LinearGradient
                colors={
                  modal.type === "success"
                    ? ["#16A34A", "#15803D"]
                    : ["#DC2626", "#B91C1C"]
                }
                style={styles.modalIcon}
              >
                {modal.type === "success" ? (
                  <CheckCircle2 size={42} color="#FFFFFF" />
                ) : (
                  <TriangleAlert size={42} color="#FFFFFF" />
                )}
              </LinearGradient>

              <Text style={styles.modalTitle}>{modal.title}</Text>

              <Text style={styles.modalMessage}>{modal.message}</Text>

              <TouchableOpacity activeOpacity={0.9} onPress={closeModal}>
                <LinearGradient
                  colors={["#2563EB", "#1D4ED8"]}
                  style={styles.modalBtn}
                >
                  <Text style={styles.modalBtnText}>OK</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </LinearGradient>
    </SafeAreaView>
  );
}

function Field({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  autoCapitalize = "sentences",
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>

      <LinearGradient
        colors={
          focused
            ? ["rgba(59,130,246,0.18)", "rgba(59,130,246,0.08)"]
            : ["rgba(255,255,255,0.05)", "rgba(255,255,255,0.02)"]
        }
        style={[styles.inputBox, focused && styles.inputFocused]}
      >
        <View style={[styles.iconWrap, focused && styles.iconWrapFocused]}>
          {icon}
        </View>

        <TextInput
          mode="flat"
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#475569"
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={styles.input}
          underlineColor="transparent"
          activeUnderlineColor="transparent"
          cursorColor="#3B82F6"
          textColor="#FFFFFF"
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
  );
}

function PasswordField({
  label,
  value,
  onChangeText,
  secure,
  setSecure,
  placeholder,
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>

      <LinearGradient
        colors={
          focused
            ? ["rgba(59,130,246,0.18)", "rgba(59,130,246,0.08)"]
            : ["rgba(255,255,255,0.05)", "rgba(255,255,255,0.02)"]
        }
        style={[styles.inputBox, focused && styles.inputFocused]}
      >
        <View style={[styles.iconWrap, focused && styles.iconWrapFocused]}>
          <Lock size={18} color="#60A5FA" />
        </View>

        <TextInput
          mode="flat"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secure}
          placeholder={placeholder}
          placeholderTextColor="#475569"
          style={styles.input}
          underlineColor="transparent"
          activeUnderlineColor="transparent"
          cursorColor="#3B82F6"
          textColor="#FFFFFF"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          theme={{
            colors: {
              text: "#FFFFFF",
              primary: "#3B82F6",
              background: "transparent",
            },
          }}
        />

        <TouchableOpacity
          style={styles.eyeBtn}
          onPress={() => setSecure(!secure)}
        >
          {secure ? (
            <EyeOff size={18} color="#94A3B8" />
          ) : (
            <Eye size={18} color="#94A3B8" />
          )}
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

function ReadonlyField({ label, icon, value }) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>

      <LinearGradient
        colors={["rgba(255,255,255,0.03)", "rgba(255,255,255,0.01)"]}
        style={[styles.inputBox, styles.inputDisabled]}
      >
        <View style={styles.iconWrap}>{icon}</View>

        <Text numberOfLines={1} style={styles.readonlyText}>
          {value || "Unknown Device"}
        </Text>
      </LinearGradient>
    </View>
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
    paddingVertical: 34,
  },

  glowOne: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 999,
    backgroundColor: "rgba(37,99,235,0.20)",
    top: -120,
    right: -100,
  },

  glowTwo: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.10)",
    bottom: -100,
    left: -80,
  },

  header: {
    alignItems: "center",
    marginBottom: 26,
  },

  logo: {
    width: 88,
    height: 88,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900",
    textAlign: "center",
  },

  subtitle: {
    color: "#94A3B8",
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 21,
  },

  card: {
    backgroundColor: "rgba(15,23,42,0.92)",
    borderRadius: 30,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 26,
  },

  cardTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
  },

  cardDesc: {
    color: "#94A3B8",
    marginTop: 8,
    lineHeight: 20,
    width: 220,
  },

  sparkWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },

  fieldContainer: {
    marginBottom: 16,
  },

  fieldLabel: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginBottom: 10,
    marginLeft: 4,
  },

  inputBox: {
    minHeight: 62,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },

  inputFocused: {
    borderColor: "rgba(59,130,246,0.45)",
    shadowColor: "#2563EB",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    elevation: 6,
  },

  inputDisabled: {
    opacity: 0.72,
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

  iconWrapFocused: {
    backgroundColor: "rgba(59,130,246,0.22)",
  },

  input: {
    flex: 1,
    backgroundColor: "transparent",
    fontSize: 15,
  },

  readonlyText: {
    flex: 1,
    color: "#94A3B8",
    fontSize: 15,
    fontWeight: "700",
  },

  eyeBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  submitBtn: {
    height: 60,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },

  submitText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 1,
  },

  backToLoginBtn: {
    marginTop: 18,
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.25)",
    backgroundColor: "rgba(15,23,42,0.75)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  backToLoginText: {
    color: "#BFDBFE",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  note: {
    color: "#64748B",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 16,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2,6,23,0.78)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  modalCard: {
    width: "100%",
    backgroundColor: "#0F172A",
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  modalIcon: {
    width: 86,
    height: 86,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  modalTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },

  modalMessage: {
    color: "#94A3B8",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 22,
  },

  modalBtn: {
    minWidth: 140,
    height: 50,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },

  modalBtnText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});
