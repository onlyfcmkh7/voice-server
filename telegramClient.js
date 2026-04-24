import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import input from "input";

const apiId = 32996008;
const apiHash = "ec81a5a75b0180b6e514ce2afaf3278b";

// тимчасово порожня сесія, щоб отримати новий SESSION STRING
const stringSession = new StringSession("");

export const client = new TelegramClient(stringSession, apiId, apiHash, {
  connectionRetries: 5,
});

let telegramStarted = false;

export async function startTelegram() {
  if (telegramStarted) return;

  await client.start({
    phoneNumber: async () => await input.text("Введи номер: "),
    password: async () => await input.text("Введи пароль (якщо є): "),
    phoneCode: async () => await input.text("Код з Telegram: "),
    onError: (err) => console.log(err),
  });

  telegramStarted = true;

  console.log("Telegram підключений");
  console.log("SESSION STRING:", client.session.save());
}

export async function getUnreadTelegramMessages(limitPerDialog = 10) {
  if (!telegramStarted) {
    await startTelegram();
  }

  const dialogs = await client.getDialogs({});
  const result = [];

  for (const dialog of dialogs) {
    const unreadCount = dialog.unreadCount || 0;

    if (unreadCount <= 0) continue;

    const title =
      dialog.title ||
      dialog.name ||
      dialog.entity?.title ||
      dialog.entity?.username ||
      "Без назви";

    const messages = await client.getMessages(dialog.entity, {
      limit: Math.min(unreadCount, limitPerDialog),
    });

    const cleanMessages = messages
      .map((msg) => ({
        chat: title,
        text: msg.message || "",
        date: msg.date,
      }))
      .filter((msg) => msg.text.trim().length > 0);

    result.push(...cleanMessages);
  }

  return result;
}
