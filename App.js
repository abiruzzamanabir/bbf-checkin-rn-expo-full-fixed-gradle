import React from "react";

import { StatusBar } from "expo-status-bar";

import { StyleSheet } from "react-native";

import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { GestureHandlerRootView } from "react-native-gesture-handler";

import { Provider as PaperProvider, MD3DarkTheme } from "react-native-paper";

import AppNavigator from "./src/navigation/AppNavigator";

import { RoleProvider } from "./src/context/RoleContext";

/* ---------------- PAPER THEME ---------------- */

const theme = {
  ...MD3DarkTheme,

  roundness: 6,

  colors: {
    ...MD3DarkTheme.colors,

    primary: "#22C55E",

    secondary: "#16A34A",

    background: "#020617",

    surface: "#0F172A",

    surfaceVariant: "#111827",

    outline: "rgba(255,255,255,0.08)",

    onSurface: "#FFFFFF",

    onBackground: "#FFFFFF",

    elevation: {
      level0: "transparent",
      level1: "#111827",
      level2: "#172033",
      level3: "#1E293B",
      level4: "#243041",
      level5: "#2A3B52",
    },
  },
};

/* ---------------- APP ---------------- */

export default function App() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <RoleProvider>
            <SafeAreaView
              style={styles.container}
              edges={["top", "bottom", "left", "right"]}
            >
              <StatusBar
                style="light"
                translucent={false}
                backgroundColor="#020617"
              />

              <AppNavigator />
            </SafeAreaView>
          </RoleProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  container: {
    flex: 1,
    backgroundColor: "#020617",
  },
});
