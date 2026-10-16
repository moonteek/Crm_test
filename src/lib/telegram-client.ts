// A tiny Telegram Bot API client over fetch (no library). The token never appears in errors or logs.

export class TelegramError extends Error {
  constructor(public status: number, description: string) {
    super(description);
  }
}

export type Update = {
  update_id: number;
  message?: {
    chat: { id: number; type: string };
    from?: { id: number };
    text?: string;
    contact?: { phone_number: string; user_id?: number };
  };
};

export type TelegramClient = {
  sendMessage(chatId: string, text: string, extra?: object): Promise<void>;
  getUpdates(offset: number, timeoutSec: number): Promise<Update[]>;
  getMe(): Promise<{ username: string }>;
};

export function telegramClient(token: string, timeoutMs = 40_000): TelegramClient {
  async function call<T>(method: string, body: object): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      throw new TelegramError(0, `Telegram bilan aloqa yo'q (${(e as Error).name})`);
    }
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string; error_code?: number };
    if (!data.ok) throw new TelegramError(data.error_code ?? res.status, data.description ?? `HTTP ${res.status}`);
    return data.result as T;
  }
  return {
    sendMessage: async (chatId, text, extra = {}) => { await call("sendMessage", { chat_id: chatId, text, ...extra }); },
    getUpdates: (offset, timeoutSec) => call<Update[]>("getUpdates", { offset, timeout: timeoutSec, allowed_updates: ["message"] }),
    getMe: () => call<{ username: string }>("getMe", {}),
  };
}
