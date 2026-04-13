export default ({ config }) => ({
  ...config,
  extra: {
    API_BASE_URL: "https://bangladeshbrandforum.com/checkin/api",
    SCAN_PATH: "/scan",
    eas: {
      projectId: "22d7f880-7a57-4dee-8ee3-a1b0f1a2ca43",
    },
    plugins: ["expo-font"],
  },
});
