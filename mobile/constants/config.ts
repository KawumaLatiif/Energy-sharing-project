import { Platform } from "react-native";

/**
 * Android emulator: 10.0.2.2 maps to host machine localhost.
 * Physical device: set EXPO_PUBLIC_API_URL to your PC's LAN IP, e.g. http://192.168.1.10:8000/api/v1
 */
const DEFAULT_API_URL =
  Platform.OS === "android"
    ? "http://10.0.2.2:8000/api/v1"
    : "http://localhost:8000/api/v1";

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL;

export const APP_NAME = "gPawa";
