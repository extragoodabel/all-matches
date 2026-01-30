import { useState, useEffect } from "react";

const STORAGE_KEY = "matchPreferences";

export type MatchPreferences = {
  minAge: number;
  maxAge: number;
  genderPreference: "male" | "female" | "all";
};

const DEFAULT_PREFERENCES: MatchPreferences = {
  minAge: 21,
  maxAge: 99,
  genderPreference: "all",
};

function loadPreferences(): MatchPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      console.log("[Preferences] Loaded from localStorage:", parsed);
      return {
        minAge: parsed.minAge ?? DEFAULT_PREFERENCES.minAge,
        maxAge: parsed.maxAge ?? DEFAULT_PREFERENCES.maxAge,
        genderPreference: parsed.genderPreference ?? DEFAULT_PREFERENCES.genderPreference,
      };
    }
  } catch (e) {
    console.error("[Preferences] Failed to load:", e);
  }
  console.log("[Preferences] Using defaults:", DEFAULT_PREFERENCES);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PREFERENCES));
  return { ...DEFAULT_PREFERENCES };
}

function savePreferences(prefs: MatchPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    console.log("[Preferences] Saved to localStorage:", prefs);
  } catch (e) {
    console.error("[Preferences] Failed to save:", e);
  }
}

export function usePreferences() {
  const [preferences, setPreferencesState] = useState<MatchPreferences>(() => loadPreferences());

  const setPreferences = (newPrefs: MatchPreferences) => {
    setPreferencesState(newPrefs);
    savePreferences(newPrefs);
  };

  const resetPreferences = () => {
    localStorage.removeItem(STORAGE_KEY);
    setPreferencesState({ ...DEFAULT_PREFERENCES });
    savePreferences(DEFAULT_PREFERENCES);
    console.log("[Preferences] Reset to defaults");
  };

  return {
    preferences,
    setPreferences,
    resetPreferences,
    DEFAULT_PREFERENCES,
  };
}
