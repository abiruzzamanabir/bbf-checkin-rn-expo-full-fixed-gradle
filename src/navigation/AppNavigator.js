import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LoginScreen from "../screens/LoginScreen";
import HomeScreen from "../screens/HomeScreen";
import ScannerScreen from "../screens/ScannerScreen";
import HistoryScreen from "../screens/HistoryScreen";
import AdminScreen from "../screens/AdminScreen";
import { getToken } from "../storage/token";
import { useRole } from "../context/RoleContext";

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const [initialRoute, setInitialRoute] = useState("Login");
  const [ready, setReady] = useState(false);
  const { ready: roleReady, role } = useRole();

  useEffect(() => {
    (async () => {
      const t = await getToken();
      setInitialRoute(t ? "Home" : "Login");
      setReady(true);
    })();
  }, []);

  if (!ready || !roleReady) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerTintColor: "white",
          headerStyle: { backgroundColor: "#0b1220" },
          headerTitleStyle: { fontWeight: "900" },
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: "BBF Check-in" }} />
        <Stack.Screen name="Scanner" component={ScannerScreen} options={{ title: "Scan QR" }} />
        <Stack.Screen name="History" component={HistoryScreen} options={{ title: "History" }} />
        <Stack.Screen
          name="Admin"
          component={AdminScreen}
          options={{
            title: "Admin",
            // simple guard: if not admin, still allow but screen will show unlock UI
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
