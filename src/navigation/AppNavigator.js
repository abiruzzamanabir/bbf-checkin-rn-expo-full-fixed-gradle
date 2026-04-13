import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, ActivityIndicator, StatusBar } from "react-native";

import LoginScreen from "../screens/LoginScreen";
import SplashScreen from "../screens/SplashScreen";
import MainTabs from "./MainTabs";

import { getToken } from "../storage/token";
import { useRole } from "../context/RoleContext";

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const [authRoute, setAuthRoute] = useState("Login");
  const [ready, setReady] = useState(false);

  const { ready: roleReady } = useRole();

  useEffect(() => {
    (async () => {
      const token = await getToken();

      setAuthRoute(token ? "Main" : "Login");

      setReady(true);
    })();
  }, []);

  if (!ready || !roleReady) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar barStyle="light-content" backgroundColor="#071B3A" />

      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen
          name="Splash"
          component={SplashScreen}
          initialParams={{ nextRoute: authRoute }}
        />

        <Stack.Screen name="Login" component={LoginScreen} />

        <Stack.Screen name="Main" component={MainTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
