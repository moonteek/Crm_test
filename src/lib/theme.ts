export type Theme = "light" | "dark" | "auto";

export const THEME_COOKIE = "theme";

/** The theme stored in the cookie; anything missing or unknown means "follow the device". */
export function parseTheme(value: string | undefined): Theme {
  return value === "light" || value === "dark" ? value : "auto";
}
