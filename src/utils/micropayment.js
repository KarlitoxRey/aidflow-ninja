import MicropaymentLog from "../models/MicropaymentLog.js";

/**
 * Verifica si el usuario puede recibir un micropago hoy
 */
export async function canMakeMicropayment(userId) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const micropaymentsToday = await MicropaymentLog.countDocuments({
    userId,
    createdAt: { $gte: todayStart, $lt: todayEnd }
  });

  return micropaymentsToday === 0;
}

/**
 * Valida el evento del micropago
 */
export async function validateEvent(userId, eventType) {
  const VALID_EVENTS = ["duelo", "torneo", "DAO_payout"];

  if (!VALID_EVENTS.includes(eventType)) {
    throw new Error("Evento no permitido");
  }

  const canPay = await canMakeMicropayment(userId);
  if (!canPay) {
    throw new Error("Ya realizaste un micropago hoy");
  }

  return true;
}

/**
 * Registra el micropago
 */
export async function registerMicropayment({
  userId,
  amount,
  eventType,
  referenceId = null,
  notes = ""
}) {
  await validateEvent(userId, eventType);

  const micropayment = new MicropaymentLog({
    userId,
    amount,
    eventType,
    referenceId,
    notes,
    status: "completed"
  });

  await micropayment.save();
  return micropayment;
}
