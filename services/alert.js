/**
 * Telegram alert service helpers.
 */


import { fetchWithRetry } from "../utils.js";
import { getAlertRecipients } from "../db.js";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const previousStatuses = new Map();

const sendTelegramAlert = async (message) => {
  if (!TELEGRAM_BOT_TOKEN) {
    console.log("Telegram alert skipped: TELEGRAM_BOT_TOKEN not set.");
    return;
  }
  const recipients = getAlertRecipients();
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  let requests = recipients.map((recipient) =>
    fetchWithRetry(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: recipient.chat_id,
        text: message,
        parse_mode: "HTML",
      }),
    }),
  );
  const responses = await Promise.allSettled(requests);
};

export const outageAlertCheck = (isUp, host) => {
  const hostLastStatus = previousStatuses.get(host.id);

  // First check DOWN alert.
  if (hostLastStatus === undefined && !isUp) {
    sendTelegramAlert(
      `🚨 <i>OUTAGE ALERT</i>\nHost <b>${host.name}</b> (${host.url}) is <strong>DOWN</strong>!`,
    );
  } else if (hostLastStatus !== undefined && hostLastStatus !== isUp) {
    // Host status changed, fire a notification.
    if (!isUp) {
      sendTelegramAlert(
        `🚨 <i>OUTAGE ALERT</i>\nHost <b>${host.name}</b> (${host.url}) is <strong>DOWN</strong>!`,
      );
    } else {
      sendTelegramAlert(
        `✅ <i>RECOVERY NOTICE</i>\nHost <b>${host.name}</b> (${host.url}) is back <b>ONLINE</b>!`,
      );
    }
  }
  previousStatuses.set(host.id, isUp);
};
