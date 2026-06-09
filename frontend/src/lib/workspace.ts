export type WorkspaceView = "split" | "chat" | "prioritization" | "documents" | "sprint" | "retro" | "supervisor" | "integrations" | "settings";

export interface AppSettings {
  apiBaseUrl: string;
  defaultModel: "auto" | "gpt-4o" | "mistral-large";
  language: "auto" | "en" | "fr";
}

export const DEFAULT_SETTINGS: AppSettings = {
  apiBaseUrl:
    process.env.NEXT_PUBLIC_API_URL ??
    (process.env.NODE_ENV === "development" ? "http://localhost:8000" : ""),
  defaultModel: "auto",
  language: "auto",
};
