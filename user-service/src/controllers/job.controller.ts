import moment from "moment-timezone";
import { agenda } from "@utils/agenda";

interface ReminderJobInput {
  dbName: string;
  companyId: string;
  companyObjId: string;
  endDate: string; // ISO string (e.g., "2025-06-30T00:00:00Z")
  token?: string;
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
  if (!endDate) {
    throw new Error("Invalid subscription end date.");
  }

  // Parse ISO date as UTC moment
  const billingDateUtc = moment.utc(endDate);

  if (!billingDateUtc.isValid()) {
    throw new Error("Invalid subscription end date format.");
  }

  console.log("📅 Subscription Billing Date (UTC):", billingDateUtc.format());

  const baseData = {
    dbName,
    companyId,
    companyObjId,
    nextBillingDate: billingDateUtc.toISOString(),
    companyEmail,
    ...(token && { token }),
  };

  const reminders = [
    { label: "5_days_before", time: billingDateUtc.clone().subtract(5, "days") },
    { label: "on_due_date", time: billingDateUtc.clone() },
    { label: "3_days_after", time: billingDateUtc.clone().add(3, "days") },
  ];

  for (const reminder of reminders) {
    await agenda.schedule(reminder.time.toDate(), "send-subscription-reminder", {
      ...baseData,
      when: reminder.label,
    });
    console.log(`✅ Scheduled: ${reminder.label} => ${reminder.time.toISOString()}`);
  }

  console.log(`📬 All subscription reminders scheduled for company ${companyId}`);
};

