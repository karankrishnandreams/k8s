import { agenda } from "../utils/agenda";

import moment from "moment";

export const scheduleSubscriptionReminders = async ({
  dbName,
  companyId,
  companyObjId,
  endDate,
  companyEmail,
}: {
  dbName: string;
  companyId: string;
  companyObjId: string;
  endDate: number; // Unix timestamp in seconds
  companyEmail: string;
}) => {
  if (!endDate || isNaN(endDate)) {
    throw new Error("Invalid subscription end date.");
  }

  const billingDate = moment.utc(endDate * 1000);

  const baseData = {
    dbName,
    companyId,
    companyObjId,
    nextBillingDate: billingDate.toDate(),
    companyEmail,
  };

  await agenda.schedule(
    billingDate.clone().subtract(5, "day").toDate(),
    "send-subscription-reminder",
    {
      ...baseData,
      when: "5_days_before",
    }
  );

  await agenda.schedule(billingDate.toDate(), "send-subscription-reminder", {
    ...baseData,
    when: "on_due_date",
  });

  await agenda.schedule(
    billingDate.clone().add(3, "day").toDate(),
    "send-subscription-reminder",
    {
      ...baseData,
      when: "3_days_after",
    }
  );

};

export const scheduleEventReminders = async ({
  dbName,
  companyObjId,
  eventId,
  event_title,
  event_date,
  start_time,
  eventStartTime,
  eventEndTime,
  location,
  event_url,
  email,
  user_name,
  company_id,
  assignee,
  userId,
  timeZone
}: {
  dbName: string;
  companyObjId: string;
  eventId: string;
  event_title: string;
  event_date: string;
  start_time: string;
  eventStartTime: string;
  eventEndTime: string;
  location: string;
  event_url: string;
  email: any;
  user_name: string;
  company_id: string;
  assignee: string;
  userId: string;
  timeZone?: string;
}) => {
  // Combine local date + time (in IST timezone)
  let eventDateTimeIST;
  if (timeZone) {
    // Use provided timeZone
    eventDateTimeIST = moment.tz(
      `${event_date} ${eventStartTime}`,
      "YYYY-MM-DD HH:mm:ss",
      timeZone
    );
  } else {
    // Fallback: parse as local time (no timezone conversion)
    eventDateTimeIST = moment(`${event_date} ${eventStartTime}`, "YYYY-MM-DD HH:mm:ss");
  }

  if (!eventDateTimeIST.isValid()) {
    throw new Error("Invalid event date or start time.");
  }
  const eventDateTimeUTC = eventDateTimeIST.clone().utc();


  if (!eventDateTimeUTC.isValid()) {
    throw new Error("Invalid event date or start time.");
  }

  const baseData = {
    dbName,
    companyObjId,
    eventId,
    event_title,
    event_date,
    start_time,
    eventStartTime,
    eventEndTime,
    location,
    event_url,
    email,
    user_name,
    company_id,
    assignee,
    userId,
  };

  const reminders = [
    // { label: "1_hour_before", time: eventDateTimeUTC.clone().subtract(1, "hour") },
    // { label: "30_minutes_before", time: eventDateTimeUTC.clone().subtract(30, "minutes") },
    // { label: "10_minutes_before", time: eventDateTimeUTC.clone().subtract(10, "minutes") },
    // { label: "5_minutes_before", time: eventDateTimeUTC.clone().subtract(5, "minutes") },
    {
      label: "3_minutes_before",
      time: eventDateTimeUTC.clone().subtract(3, "minutes"),
    },
    {
      label: "2_minutes_before",
      time: eventDateTimeUTC.clone().subtract(2, "minutes"),
    },
    {
      label: "1_minute_before",
      time: eventDateTimeUTC.clone().subtract(1, "minutes"),
    },
    {
      label: "30_seconds_before",
      time: eventDateTimeUTC.clone().subtract(30, "seconds"),
    },
  ];

  for (const reminder of reminders) {
    await agenda.schedule(reminder.time.toDate(), "send-event-reminder", {
      ...baseData,
      when: reminder.label,
    });
  }

  console.log(
    "🔔 Event reminders scheduled at UTC:",
    eventDateTimeUTC.toISOString()
  );
};
