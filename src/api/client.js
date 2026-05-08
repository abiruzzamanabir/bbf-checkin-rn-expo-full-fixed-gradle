import axios from "axios";

import Constants from "expo-constants";

import { getToken, clearToken } from "../storage/token";

/* ---------------- BASE URL ---------------- */

const rawBase = Constants.expoConfig?.extra?.API_BASE_URL || "";

/* remove trailing slash */

const base = rawBase.replace(/\/$/, "");

/* final api url */

const API_URL = `${base}/api`;

/* ---------------- DEBUG ---------------- */

// console.log("API BASE URL:", API_URL);

/* ---------------- AXIOS INSTANCE ---------------- */

export const api = axios.create({
  baseURL: API_URL,

  timeout: 20000,

  headers: {
    Accept: "application/json",

    "Content-Type": "application/json",
  },
});

/* ---------------- REQUEST INTERCEPTOR ---------------- */

api.interceptors.request.use(
  async (config) => {
    try {
      const token = await getToken();

      /* -------- TOKEN -------- */

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      /* -------- DEBUG -------- */

      // console.log(
      //   "REQUEST:",
      //   config.method?.toUpperCase(),
      //   `${config.baseURL}${config.url}`,
      // );

      // console.log("PARAMS:", config.params);

      // console.log("BODY:", config.data);

      return config;
    } catch (e) {
      // console.log("REQUEST INTERCEPTOR ERROR:", e);

      return config;
    }
  },

  (error) => {
    // console.log("REQUEST ERROR:", error);

    return Promise.reject(error);
  },
);

/* ---------------- RESPONSE INTERCEPTOR ---------------- */

api.interceptors.response.use(
  (response) => {
    // console.log("RESPONSE:", response?.config?.url);

    // console.log("STATUS:", response?.status);

    // console.log("DATA:", response?.data);

    return response;
  },

  async (error) => {
    const status = error?.response?.status;

    /* ---------------- DEBUG ---------------- */

    // console.log("API ERROR URL:", error?.config?.url);

    // console.log("API ERROR STATUS:", status);

    // console.log("API ERROR DATA:", error?.response?.data);

    // console.log("FULL ERROR:", error);

    /* ---------------- UNAUTHORIZED ---------------- */

    if (status === 401) {
      // console.log("SESSION EXPIRED");

      try {
        await clearToken();
      } catch (e) {
        // console.log("CLEAR TOKEN ERROR:", e);
      }

      // OPTIONAL:
      // navigate to login
      // emit logout event
    }

    /* ---------------- FORBIDDEN ---------------- */

    if (status === 403) {
      // console.log("FORBIDDEN ACCESS");
    }

    /* ---------------- NOT FOUND ---------------- */

    if (status === 404) {
      // console.log("API ROUTE NOT FOUND");
    }

    /* ---------------- SERVER ERROR ---------------- */

    if (status >= 500) {
      // console.log("SERVER ERROR");
    }

    /* ---------------- NETWORK ERROR ---------------- */

    if (!error.response) {
      // console.log("NETWORK ERROR / OFFLINE");
    }

    /* ---------------- TIMEOUT ---------------- */

    if (error.code === "ECONNABORTED") {
      // console.log("REQUEST TIMEOUT");
    }

    return Promise.reject(error);
  },
);
