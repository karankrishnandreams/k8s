import { agenda } from "@utils/agenda";
import dayjs from "dayjs";

interface ReminderJobInput {
  dbName: string;
  companyId: string;
  companyObjId: string;
  endDate: string; // ISO 8601 date string
  token?: string; // optional
  companyEmail: string;
}

export const scheduleSubscriptionReminders = async ({
  dbName,
  companyId,
  companyObjId,
  endDate,
  token,
  companyEmail,
}: ReminderJobInput) => {
  await agenda.start(); // make sure this runs only once if shared

  const billingDate = dayjs(endDate); // now parsing ISO string

  const baseData = {
    dbName,
    companyId,
    companyObjId,
    nextBillingDate: billingDate.toDate(),
    companyEmail
  };

  await agenda.schedule(
    billingDate.subtract(5, "day").toDate(),
    "send-subscription-reminder",
    { ...baseData, when: "5_days_before", ...(token && { token }) }
  );

  await agenda.schedule(
    billingDate.toDate(),
    "send-subscription-reminder",
    { ...baseData, when: "on_due_date", ...(token && { token }) }
  );

  await agenda.schedule(
    billingDate.add(3, "day").toDate(),
    "send-subscription-reminder",
    { ...baseData, when: "3_days_after", ...(token && { token }) }
  );
};
