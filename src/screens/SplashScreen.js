import React, { useEffect } from "react";
import { View, StyleSheet,Text } from "react-native";
import LottieView from "lottie-react-native";

export default function SplashScreen({ navigation, route }) {
  const nextRoute = route?.params?.nextRoute || "Login";

  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace(nextRoute);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <LottieView
        source={require("../../assets/bbf-loader.json")}
        autoPlay
        loop
        style={{ width: 260, height: 260 }}
      />
      <Text
        style={{
          color: "#9FB4D9",
          marginTop: 10,
          fontWeight: "700",
        }}
      >
        Preparing Scanner...
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#071B3A",
    alignItems: "center",
    justifyContent: "center",
  },

  animation: {
    width: 260,
    height: 260,
  },
});
