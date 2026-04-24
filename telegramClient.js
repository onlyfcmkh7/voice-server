import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import input from "input";

const apiId = 32996008;
const apiHash = "ec81a5a75b0180b6e514ce2afaf3278b";

const stringSession = new StringSession("1AgAOMTQ5LjE1NC4xNjcuNDEBu41XdoFbUZO2MWH2PjcBqwuYFXT38D6KDiqJnv7demE+6AJ+iuP0WZ/OZEgprydp/kDTAtLIyvAby2gq7aRvSsJA/UMUq+LCCNoHCqfDUjQhb2UYFUI4SHdq2gZDVmJcXJxK2CtpFq9NJ2GVIL1j56u8mfsTukVom5liQczGzCOlKy/3CuCl/j+mRPGtvGNHQoWEjyyVs/jY8AZhixv6guarLztqLok1mXaXCCFF7vTBms5h8LG8h3/h9+tq5IjtE4N60D2OsDscH/R4zjFdk6Lfrc/KSPobLUrL03/LYF6qZUeCGjiSUhS+Qo+eo7fcOy2JAjpF8S1epxvvXNoSLbk=");

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
