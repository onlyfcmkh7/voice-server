import { google } from "googleapis";

function getGmailClient() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Gmail env variables are missing");
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    "https://developers.google.com/oauthplayground"
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken
  });

  return google.gmail({
    version: "v1",
    auth: oauth2Client
  });
}

function getHeader(headers, name) {
  return headers.find(
    (header) => header.name.toLowerCase() === name.toLowerCase()
  )?.value || "";
}

function detectResume(text) {
  const lower = text.toLowerCase();

  if (
    lower.includes("android") ||
    lower.includes("ai developer") ||
    lower.includes("voice")
  ) {
    return "Android / AI Developer";
  }

  if (
    lower.includes("horeca") ||
    lower.includes("менеджер") ||
    lower.includes("ресторан") ||
    lower.includes("клієнтами")
  ) {
    return "Менеджер HoReCa";
  }

  return "Невідоме резюме";
}

function detectEventType(text) {
  const lower = text.toLowerCase();

  if (
    lower.includes("пропозиція від роботодавця") ||
    lower.includes("вам пропонують") ||
    lower.includes("надіслали пропозицію") ||
    lower.includes("пропонує вам роботу")
  ) {
    return "job_offer";
  }

  if (
    lower.includes("роботодавець зацікавився") ||
    lower.includes("зацікавився вашим резюме")
  ) {
    return "employer_interest";
  }

  if (
    lower.includes("резюме переглянули") ||
    lower.includes("переглянули ваше резюме") ||
    lower.includes("ваше резюме переглянуто")
  ) {
    return "resume_view";
  }

  if (
    lower.includes("відгук переглянуто") ||
    lower.includes("ваш відгук переглянули") ||
    lower.includes("роботодавець переглянув ваш відгук")
  ) {
    return "application_view";
  }

  if (
    lower.includes("нове повідомлення") ||
    lower.includes("вам написали") ||
    lower.includes("повідомлення від роботодавця")
  ) {
    return "message";
  }

  return null;
}

function isImportantWorkUaEmail(text) {
  return detectEventType(text) !== null;
}

export async function getWorkUaEmails() {
  const gmail = getGmailClient();

  const list = await gmail.users.messages.list({
    userId: "me",
    maxResults: 20,
    q: 'from:(work.ua) newer_than:14d'
  });

  const messages = list.data.messages || [];
  const emails = [];

  for (const message of messages) {
    const full = await gmail.users.messages.get({
      userId: "me",
      id: message.id,
      format: "metadata",
      metadataHeaders: ["Subject", "From", "Date"]
    });

    const headers = full.data.payload?.headers || [];
    const subject = getHeader(headers, "Subject");
    const from = getHeader(headers, "From");
    const date = getHeader(headers, "Date");
    const snippet = full.data.snippet || "";

    const text = `${subject} ${snippet}`;

    if (!isImportantWorkUaEmail(text)) {
      continue;
    }

    emails.push({
      id: message.id,
      resume: detectResume(text),
      type: detectEventType(text),
      subject,
      from,
      date,
      snippet
    });
  }

  return emails;
}
