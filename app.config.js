export default ({ config }) => ({
  ...config,

  // ✅ Your Expo account username
  owner: "abir17",

  // ✅ This is REQUIRED so EAS can link the project
  extra: {
    eas: {
      projectId: "22d7f880-7a57-4dee-8ee3-a1b0f1a2ca43",
    },

    // Your app settings
    API_BASE_URL: "https://bangladeshbrandforum.com/checkin/api",
    EVENTS_PATH: "/events",
    GATES_PATH: "/gates",
    STATS_PATH: "/stats/event",
    TICKETS_SEARCH_PATH: "/tickets/search",
    SCAN_PATH: "/scan",
  },
});
