import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.duoleveling.covenant",
  appName: "Duo Leveling",
  webDir: "dist",
  server: {
    androidScheme: "https"
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    },

    LocalNotifications: {
        smallIcon: "ic_notification",
        iconColor: "#488AFF",
        sound: "res://notification"
    },
    StatusBar: {
      overlaysWebView: true,
      style: "DARK",
      backgroundColor: "#020617"
    },
    CapacitorHttp: {
      enabled: true
    },
    CapacitorCookies: {
      enabled: true
    }
  }
};

export default config;
