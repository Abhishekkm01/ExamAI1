import { useCallback, useEffect, useState } from "react";
import { api } from "../data/api";

export type SystemMeta = {
  university_name: string;
  academic_year: string;
  current_semester: number;
  college_logo_url?: string;
  default_exam_fee?: number;
  default_college_fee?: number;
  default_backlog_fee?: number;
};

export const SYSTEM_SETTINGS_DEFAULTS: SystemMeta = {
  university_name: "National Institute of Technology",
  academic_year: "2026-27",
  current_semester: 5,
  college_logo_url: "",
  default_exam_fee: 45000,
  default_college_fee: 25000,
  default_backlog_fee: 1500,
};

export const SYSTEM_SETTINGS_UPDATED = "examshield:settings-updated";

export function notifySystemSettingsUpdated() {
  window.dispatchEvent(new Event(SYSTEM_SETTINGS_UPDATED));
}

export function useSystemSettings() {
  const [settings, setSettings] = useState<SystemMeta>(SYSTEM_SETTINGS_DEFAULTS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    api.publicMeta()
      .then((data) => {
        setSettings({
          university_name: data?.university_name || SYSTEM_SETTINGS_DEFAULTS.university_name,
          academic_year: data?.academic_year || SYSTEM_SETTINGS_DEFAULTS.academic_year,
          current_semester: data?.current_semester ?? SYSTEM_SETTINGS_DEFAULTS.current_semester,
          college_logo_url: data?.college_logo_url || "",
          default_exam_fee: data?.default_exam_fee ?? 45000,
          default_college_fee: data?.default_college_fee ?? 25000,
          default_backlog_fee: data?.default_backlog_fee ?? 1500,
        });
      })
      .catch(() => setSettings(SYSTEM_SETTINGS_DEFAULTS))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(SYSTEM_SETTINGS_UPDATED, refresh);
    return () => window.removeEventListener(SYSTEM_SETTINGS_UPDATED, refresh);
  }, [refresh]);

  return { settings, loading, refresh };
}
