import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform
} from "react-native";

import { login } from "../api/auth";
import { setToken } from "../storage/token";

export default function LoginScreen({ navigation }) {

  const [email, setEmail] = useState("scanner@bbf.com");
  const [password, setPassword] = useState("");
  const [deviceName, setDeviceName] = useState("Scanner Device");
  const [loading, setLoading] = useState(false);

  async function onLogin() {
    try {
      setLoading(true);

      const data = await login({
        email,
        password,
        device_name: deviceName
      });

      await setToken(data.token);

      navigation.reset({
        index: 0,
        routes: [{ name: "Home" }]
      });

    } catch (e) {

      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        "Login failed. Check credentials.";

      Alert.alert("Login failed", msg);

    } finally {
      setLoading(false);
    }
  }

  return (

    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >

      {/* Logo */}
      <View style={styles.logoBox}>
        <Text style={styles.logoText}>BBF</Text>
        <Text style={styles.logoSub}>Check-in</Text>
      </View>

      {/* Card */}
      <View style={styles.card}>

        <Text style={styles.title}>Scanner Login</Text>
        <Text style={styles.subtitle}>
          Login with your event scanner account
        </Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor="#7a8aa6"
          style={styles.input}
          autoCapitalize="none"
        />

        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor="#7a8aa6"
          style={styles.input}
          secureTextEntry
        />

        <TextInput
          value={deviceName}
          onChangeText={setDeviceName}
          placeholder="Device name"
          placeholderTextColor="#7a8aa6"
          style={styles.input}
        />

        <Pressable
          style={[styles.button, loading && { opacity: 0.7 }]}
          onPress={onLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Authenticating..." : "Login"}
          </Text>
        </Pressable>

      </View>

      {/* Demo Accounts */}
      <View style={styles.demoBox}>
        <Text style={styles.demoTitle}>Demo Accounts</Text>

        <Text style={styles.demoText}>
          Admin: admin@bbf.com / Admin123!
        </Text>

        <Text style={styles.demoText}>
          Scanner: scanner@bbf.com / ChangeMe123!
        </Text>
      </View>

    </KeyboardAvoidingView>

  );
}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: "#071B3A",
    justifyContent: "center",
    padding: 24
  },

  logoBox: {
    alignItems: "center",
    marginBottom: 30
  },

  logoText: {
    fontSize: 46,
    fontWeight: "900",
    color: "#ffffff"
  },

  logoSub: {
    fontSize: 16,
    color: "#9FB4D9",
    marginTop: -6
  },

  card: {
    backgroundColor: "#0B1220",
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: "#1e2b45"
  },

  title: {
    color: "white",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center"
  },

  subtitle: {
    color: "#9FB4D9",
    textAlign: "center",
    marginBottom: 20
  },

  input: {
    backgroundColor: "#071B3A",
    borderRadius: 12,
    padding: 14,
    color: "white",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1e2b45"
  },

  button: {
    backgroundColor: "#2563EB",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 6
  },

  buttonText: {
    color: "white",
    fontWeight: "800",
    fontSize: 16
  },

  demoBox: {
    marginTop: 24,
    alignItems: "center"
  },

  demoTitle: {
    color: "#9FB4D9",
    fontWeight: "700",
    marginBottom: 6
  },

  demoText: {
    color: "#7f8fb3",
    fontSize: 13
  }

});