// Runs once when the CRM server starts: the Telegram bot (only on the Node server, only with TELEGRAM_BOT_TOKEN).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.TELEGRAM_BOT_TOKEN) return;
  const { startBot } = await import("./lib/telegram-bot");
  startBot();
}
