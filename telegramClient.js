import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";

const apiId = 32996008;
const apiHash = "ec81a5a75b0180b6e514ce2afaf3278b";

// 🔥 ТІЛЬКИ ЦІ КАНАЛИ
const TARGET_CHANNELS = [
  "huyovy_kharkiv",
  "hs_kharkiv",
  "truexanewsua",
  "cryptotruexa",
  "publicreservestugna",
  "voynareal"
];

const stringSession = new StringSession("1AgAOMTQ5LjE1NC4xNjcuNDEBu05AFOouIgIJ1vpUAq8VSa4GBV33gK/LuGB7yrvnUKLhwiZqHGhYMBBW4cYFFlgSYhbottCa3H8AzBNYS26FhoziUUxZyELS+igR7Q3EjQy43rfbzH6BO4xk6O85lwoAags/Navj3a8jmcZ4vfRPK9YPPmFfqPv6PjzF7CF036Ce8k/OFCWcZvFe+PbeJz4Zez74LnZNZTgokocO8j7/+HuLsqxpHNzx1AYakazVCDwbi50Aj9zcmWCMSXbQF4E55g1yvNkJ9q32lQiKyvL9QtkD3kFa81noIGRcshnOSZAxo3IkDhMAZRx5NKAU89PFt9XwmE+fcwVG+tkqMWaSLlU=");

export const client = new TelegramClient(stringSession, apiId, apiHash, {
  connectionRetries: 5,
});

let telegramStarted = false;

export async function startTelegram() {
  if (telegramStarted) return;

  await client.connect();
  telegramStarted = true;

  console.log("Telegram підключений");
}

export async function getUnreadTelegramMessages(limitPerDialog = 5) {
  if (!telegramStarted) {
    await startTelegram();
  }

  const result = [];

  for (const channel of TARGET_CHANNELS) {
    try {
      const messages = await client.getMessages(channel, {
        limit: limitPerDialog
      });

      const cleanMessages = messages
        .map((msg) => ({
          chat: channel,
          text: msg.message || "",
          date: msg.date,
        }))
        .filter((msg) => msg.text.trim().length > 0);

      result.push(...cleanMessages);

    } catch (e) {
      console.log("CHANNEL ERROR:", channel, e.message);
    }
  }

  return result;
}
