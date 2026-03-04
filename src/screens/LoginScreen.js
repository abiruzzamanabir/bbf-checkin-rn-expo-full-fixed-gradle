import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
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
      const data = await login({ email, password, device_name: deviceName });
      await setToken(data.token);
      navigation.reset({ index: 0, routes: [{ name: "Home" }] });
    } catch (e) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        (e?.response?.data?.errors
          ? JSON.stringify(e.response.data.errors)
          : null) ||
        "Check credentials / API";
      Alert.alert("Login failed", msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 justify-center items-center px-5 bg-[#0b1220]"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View className="w-full max-w-[420px] bg-[#101a2d] rounded-2xl p-5 border border-[#1e2b45]">
        <Text className="text-white text-3xl font-extrabold mb-1 text-center">
          BBF Check-in
        </Text>

        <Text className="text-[#b6c2d9] mb-4 text-center">
          Login with your scanner/admin account.
        </Text>

        <Text className="text-[#b6c2d9] mt-2 mb-1 font-semibold">Email</Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          className="bg-[#0b1220] text-white p-3 rounded-xl border border-[#1e2b45]"
        />

        <Text className="text-[#b6c2d9] mt-3 mb-1 font-semibold">Password</Text>

        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          className="bg-[#0b1220] text-white p-3 rounded-xl border border-[#1e2b45]"
        />

        <Text className="text-[#b6c2d9] mt-3 mb-1 font-semibold">
          Device name
        </Text>

        <TextInput
          value={deviceName}
          onChangeText={setDeviceName}
          className="bg-[#0b1220] text-white p-3 rounded-xl border border-[#1e2b45]"
        />

        <Pressable
          onPress={onLogin}
          disabled={loading}
          className={`mt-4 py-3 rounded-xl items-center ${loading ? "bg-blue-500/60" : "bg-[#2f6bff]"}`}
        >
          <Text className="text-white font-extrabold">
            {loading ? "Logging in..." : "Login"}
          </Text>
        </Pressable>

        <Text className="text-[#7f8fb3] mt-4 leading-5 text-sm">
          Demo users:
          {"\n"}Admin: admin@bbf.com / Admin123!
          {"\n"}Scanner: scanner@bbf.com / ChangeMe123!
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
