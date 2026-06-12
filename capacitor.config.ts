import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.duoleveling.covenant",
  appName: "Duo Leveling",
  webDir: "dist",
  server: {
    androidScheme: "https"
  }
};

export default config;
