export type Theme = "light" | "dark" | "auto";

export const THEME_COOKIE = "theme";

/** The theme stored in the cookie; anything missing or unknown means "follow the device". */
export function parseTheme(value: string | undefined): Theme {
  return value === "light" || value === "dark" ? value : "auto";
}

/** The theme saved in a `document.cookie` string. */
export function themeFromCookie(cookie: string): Theme {
  const match = cookie.split(/;\s*/).find((c) => c.startsWith(`${THEME_COOKIE}=`));
  return parseTheme(match?.slice(THEME_COOKIE.length + 1));
}
