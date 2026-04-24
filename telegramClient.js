import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import input from "input";

const apiId = 32996008;
const apiHash = "ec81a5a75b0180b6e514ce2afaf3278b";

const stringSession = new StringSession("");

export const client = new TelegramClient(stringSession, apiId, apiHash, {
  connectionRetries: 5,
});

export async function startTelegram() {
  await client.start({
    phoneNumber: async () => await input.text("Введи номер: "),
    password: async () => await input.text("Введи пароль (якщо є): "),
    phoneCode: async () => await input.text("Код з Telegram: "),
    onError: (err) => console.log(err),
  });

  console.log("Telegram підключений");
  console.log("SESSION STRING:", client.session.save());
}
