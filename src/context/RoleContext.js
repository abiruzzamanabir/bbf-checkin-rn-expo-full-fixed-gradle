import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ROLE_KEY = "bbf_role"; // OPERATOR | ADMIN

const RoleContext = createContext({
  role: "OPERATOR",
  setRole: async (_role) => {},
  ready: false,
});

export function RoleProvider({ children }) {
  const [role, setRoleState] = useState("OPERATOR");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(ROLE_KEY);
        if (stored === "ADMIN" || stored === "OPERATOR") setRoleState(stored);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const setRole = async (nextRole) => {
    const normalized = nextRole === "ADMIN" ? "ADMIN" : "OPERATOR";
    setRoleState(normalized);
    await AsyncStorage.setItem(ROLE_KEY, normalized);
  };

  return (
    <RoleContext.Provider value={{ role, setRole, ready }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
