import { Agenda } from "agenda";

export const agenda = new Agenda({
  db: {
    address: process.env.MONGODB_URI || "mongodb://localhost:27018/fusion_main_dev",
    collection: "agendaJobs",
  },
});
