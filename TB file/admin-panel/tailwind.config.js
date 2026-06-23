/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        gpawa: {
          cyan:  "#17C5EC",   // top of bolt
          blue:  "#1A7BD4",   // mid gradient — primary action
          navy:  "#0D2657",   // wordmark / bolt bottom
          dark:  "#071A3E",   // sidebar background
          amber: "#F59E0B",
          green: "#22C55E",
          red:   "#EF4444",
        },
      },
    },
  },
  plugins: [],
};
