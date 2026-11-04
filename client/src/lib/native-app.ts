import { Capacitor } from "@capacitor/core";

/** True only inside the iPhone/Android app shell, never in a normal browser. */
export const isNativeApp = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};
