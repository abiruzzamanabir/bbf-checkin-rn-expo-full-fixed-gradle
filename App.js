import React from "react";
import AppNavigator from "./src/navigation/AppNavigator";
import { RoleProvider } from "./src/context/RoleContext";

export default function App() {
  return (
    <RoleProvider>
      <AppNavigator />
    </RoleProvider>
  );
}
