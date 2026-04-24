import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import input from "input";

const apiId = 32996008;
const apiHash = "ec81a5a75b0180b6e514ce2afaf3278b";

const stringSession = new StringSession("1AgAOMTQ5LjE1NC4xNjcuNDEBu05AFOouIgIJ1vpUAq8VSa4GBV33gK/LuGB7yrvnUKLhwiZqHGhYMBBW4cYFFlgSYhbottCa3H8AzBNYS26FhoziUUxZyELS+igR7Q3EjQy43rfbzH6BO4xk6O85lwoAags/Navj3a8jmcZ4vfRPK9YPPmFfqPv6PjzF7CF036Ce8k/OFCWcZvFe+PbeJz4Zez74LnZNZTgokocO8j7/+HuLsqxpHNzx1AYakazVCDwbi50Aj9zcmWCMSXbQF4E55g1yvNkJ9q32lQiKyvL9QtkD3kFa81noIGRcshnOSZAxo3IkDhMAZRx5NKAU89PFt9XwmE+fcwVG+tkqMWaSLlU=");
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
