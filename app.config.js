export default {
  expo: {
    name: "Crumb",
    slug: "crumb-food-tracker",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    platforms: [
      "ios",
      "android",
      "web"
    ],
    ios: {
      supportsTablet: true
    },
    android: {
      package: "com.crumb.app",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true
    },
    web: {
      favicon: "./assets/favicon.png",
      bundler: "metro",
      lang: "en",
      themeColor: "#FF986F",
      backgroundColor: "#ffffff",
      display: "standalone",
      orientation: "portrait",
      startUrl: "/",
      scope: "/",
      shortName: "Crumb",
      name: "Crumb - Food Allergy Tracker",
      description: "Track your child's food intake and reactions to identify potential allergies",
      dir: "ltr",
      preferRelatedApplications: false,
      relatedApplications: [],
      splash: {
        backgroundColor: "#ffffff",
        resizeMode: "contain",
        image: "./assets/splash-icon.png"
      },
      meta: {
        "apple-mobile-web-app-capable": "yes",
        "apple-mobile-web-app-status-bar-style": "default",
        "apple-mobile-web-app-title": "Crumb",
        "mobile-web-app-capable": "yes",
        "theme-color": "#FF986F"
      }
    },
    extra: {
      eas: {
        projectId: "47b1540c-2c8f-4531-b920-97f46f3aacd7"
      },
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY,
      posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST
    },
    plugins: [
      "expo-localization"
    ]
  }
};
