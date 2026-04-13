import React from "react";
import { StatusBar } from "expo-status-bar";
import AppNavigator from "./src/navigation/AppNavigator";
import { RoleProvider } from "./src/context/RoleContext";

export default function App() {
  return (
    <RoleProvider>
      <StatusBar style="light" />

      <AppNavigator />
    </RoleProvider>
  );
}
