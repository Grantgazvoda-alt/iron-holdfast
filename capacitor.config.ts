import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: process.env.CAP_APP_ID || "com.ironholdfast.game",
  appName: "Iron Holdfast",
  webDir: "dist/mobile",
  server: {
    cleartext: false,
  },
};

export default config;
