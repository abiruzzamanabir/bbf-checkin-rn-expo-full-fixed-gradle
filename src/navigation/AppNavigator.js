import React, { useState, useEffect } from "react";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, ActivityIndicator, StatusBar } from "react-native";

import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import SplashScreen from "../screens/SplashScreen";
import MainTabs from "./MainTabs";

import { useRole } from "../context/RoleContext";

const Stack = createNativeStackNavigator();

/* ---------------- CUSTOM DARK THEME ---------------- */

const MyTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: "#08111F",
  },
};

/* ---------------- MAIN NAVIGATOR ---------------- */

export default function AppNavigator() {
  const { ready: roleReady } = useRole();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // small delay for smoother startup
    setTimeout(() => setReady(true), 200);
  }, []);

  /* -------- GLOBAL LOADING -------- */

  if (!ready || !roleReady) {
    return (
      <View style={styles.loader}>
        <StatusBar barStyle="light-content" backgroundColor="#08111F" />
        <ActivityIndicator size="large" color="#22C55E" />
      </View>
    );
  }

  /* -------- NAVIGATION -------- */

  return (
    <NavigationContainer theme={MyTheme}>
      <StatusBar barStyle="light-content" backgroundColor="#08111F" />

      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerShown: false,
          animation: "fade",
        }}
      >
        {/* SPLASH = SINGLE SOURCE OF TRUTH */}
        <Stack.Screen name="Splash" component={SplashScreen} />

        {/* AUTH */}
        <Stack.Screen name="Login" component={LoginScreen} />

        {/* Register */}
        <Stack.Screen name="Register" component={RegisterScreen} />

        {/* APP */}
        <Stack.Screen name="Main" component={MainTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

/* ---------------- STYLES ---------------- */

const styles = {
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#08111F",
  },
};
