/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#2563EB",
        success: "#10B981",
        danger: "#EF4444",
        bg: "#F3F4F6",
      },
    },
  },
  plugins: [],
};
