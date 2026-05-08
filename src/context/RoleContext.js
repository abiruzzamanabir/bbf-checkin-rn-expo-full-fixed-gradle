import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ROLE_KEY = "bbf_role";
const ROLE_TIME_KEY = "bbf_role_time";

const ADMIN_SESSION_MS = 30 * 60 * 1000; // 30 min

const RoleContext = createContext({
  role: "OPERATOR",
  setRole: async (_role) => {},
  ready: false,
  isAdmin: false,
});

export function RoleProvider({ children }) {
  const [role, setRoleState] = useState("OPERATOR");
  const [ready, setReady] = useState(false);

  /* ---------------- LOAD ROLE ---------------- */

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(ROLE_KEY);
        const time = await AsyncStorage.getItem(ROLE_TIME_KEY);

        if (stored === "ADMIN") {
          const now = Date.now();
          const savedTime = Number(time || 0);

          // 🔐 expire admin session
          if (now - savedTime > ADMIN_SESSION_MS) {
            await AsyncStorage.multiRemove([ROLE_KEY, ROLE_TIME_KEY]);
            setRoleState("OPERATOR");
          } else {
            setRoleState("ADMIN");
          }
        } else {
          setRoleState("OPERATOR");
        }
      } catch {
        setRoleState("OPERATOR");
      } finally {
        setReady(true);
      }
    })();
  }, []);

  /* ---------------- SET ROLE ---------------- */

  const setRole = async (nextRole) => {
    const normalized = nextRole === "ADMIN" ? "ADMIN" : "OPERATOR";

    setRoleState(normalized);

    if (normalized === "ADMIN") {
      await AsyncStorage.multiSet([
        [ROLE_KEY, "ADMIN"],
        [ROLE_TIME_KEY, String(Date.now())],
      ]);
    } else {
      await AsyncStorage.multiRemove([ROLE_KEY, ROLE_TIME_KEY]);
    }
  };

  /* ---------------- AUTO EXPIRE ---------------- */

  useEffect(() => {
    if (role !== "ADMIN") return;

    const interval = setInterval(async () => {
      const time = await AsyncStorage.getItem(ROLE_TIME_KEY);
      const savedTime = Number(time || 0);

      if (Date.now() - savedTime > ADMIN_SESSION_MS) {
        setRoleState("OPERATOR");
        await AsyncStorage.multiRemove([ROLE_KEY, ROLE_TIME_KEY]);
      }
    }, 60000); // check every minute

    return () => clearInterval(interval);
  }, [role]);

  return (
    <RoleContext.Provider
      value={{
        role,
        setRole,
        ready,
        isAdmin: role === "ADMIN",
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
