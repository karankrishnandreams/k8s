import { agenda } from "../utils/agenda";
import dayjs from "dayjs";

export const scheduleSubscriptionReminders = async ({
  dbName,
  companyId,
  companyObjId,
  endDate,
}: {
  dbName: string;
  companyId: string;
  companyObjId: string;
  endDate: number; // Unix timestamp in seconds
}) => {
  if (!endDate || isNaN(endDate)) {
    throw new Error("Invalid subscription end date.");
  }

  const billingDate = dayjs(endDate * 1000);

  const baseData = {
    dbName,
    companyId,
    companyObjId,
    nextBillingDate: billingDate.toDate(),
  };

  await agenda.schedule(billingDate.clone().subtract(5, "day").toDate(), "send-subscription-reminder", {
    ...baseData,
    when: "5_days_before",
  });

  await agenda.schedule(billingDate.toDate(), "send-subscription-reminder", {
    ...baseData,
    when: "on_due_date",
  });

  await agenda.schedule(billingDate.clone().add(3, "day").toDate(), "send-subscription-reminder", {
    ...baseData,
    when: "3_days_after",
  });

};
