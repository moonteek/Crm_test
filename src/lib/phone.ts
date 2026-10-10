/**
 * Uzbek numbers are 9 digits after the +998 country code, so the last 9 digits identify a
 * number however it was typed: "+998 90 123-45-67", "998901234567" and "901234567" all match.
 */
export function phoneKey(phone: string) {
  return phone.replace(/\D/g, "").slice(-9);
}
