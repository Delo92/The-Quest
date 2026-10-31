/** Turns technical log messages (including already-stored ones) into plain English. */

const STRIPE_CALL = /^Stripe (GET|POST|DELETE) (\S+) → (\d+) in (\d+)ms$/;
const PAYMENT_REQUEST = /^Payment request (GET|POST|PUT|DELETE) (\S+) → (\d+) in (\d+)ms$/;
const PAYMENT_CUT_OFF = /^Payment request (GET|POST|PUT|DELETE) (\S+) was cut off after (\d+)ms/;

function requestLabel(path: string): string {
  if (/guest\/checkout/.test(path)) return "Vote purchase";
  if (/payment-provider|payment\/.*intent/.test(path)) return "Card payment setup";
  if (/webhooks/.test(path)) return "Payment provider notification";
  return "Payment request";
}

/** Successful, fast background calls that only add noise to the list. */
export function isRoutineLog(message: string): boolean {
  const stripe = message.match(STRIPE_CALL);
  if (stripe) return Number(stripe[3]) < 400 && Number(stripe[4]) <= 8000;
  const request = message.match(PAYMENT_REQUEST);
  return !!request && Number(request[3]) < 400 && Number(request[4]) <= 8000 && request[1] === "GET";
}

export function humanizeLogMessage(message: string): string {
  const stripe = message.match(STRIPE_CALL);
  if (stripe) {
    const [, method, path, status, ms] = stripe;
    const id = path.match(/(pi_\w+|ch_\w+|re_\w+)/)?.[1];
    const what = /payment_intents/.test(path)
      ? (method === "POST" ? (id ? "update or confirm a payment" : "create a payment") : "check a payment's status")
      : /refunds/.test(path) ? "process a refund" : "contact Stripe";
    const outcome = Number(status) >= 500 ? `Stripe had a server problem (error ${status})`
      : Number(status) >= 400 ? `Stripe rejected the request (error ${status})`
      : Number(ms) > 8000 ? `it worked but was slow (${(Number(ms) / 1000).toFixed(1)} seconds)` : "it worked";
    return `Tried to ${what}${id ? ` for ${id}` : ""}: ${outcome}`;
  }
  const request = message.match(PAYMENT_REQUEST);
  if (request) {
    const [, , path, status, ms] = request;
    const label = requestLabel(path);
    return Number(status) >= 400 ? `${label} failed (error ${status})`
      : Number(ms) > 8000 ? `${label} succeeded but was slow (${(Number(ms) / 1000).toFixed(1)} seconds)`
      : `${label} succeeded`;
  }
  const cut = message.match(PAYMENT_CUT_OFF);
  if (cut) {
    return `${requestLabel(cut[2])} was interrupted after ${(Number(cut[3]) / 1000).toFixed(1)} seconds, before the customer got a response (their connection probably dropped)`;
  }
  if (/Failed to fetch dynamically imported module/i.test(message)) {
    const device = message.match(/\[([^\]]+)\]/)?.[1];
    const page = message.match(/assets\/([A-Za-z]+)-/)?.[1];
    return `A visitor's browser couldn't load part of the site${page ? ` (the ${page} page)` : ""}${device ? ` on ${device}` : ""}. This usually happens right after an update or on a poor connection, and a refresh fixes it.`;
  }
  return message;
}
