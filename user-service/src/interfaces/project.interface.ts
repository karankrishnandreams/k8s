// src/feature-module/super-admin/project/interfaces/project.interface.ts

export interface IProject {
  projectNumber:   string;
  entity:          string;
  branch:          string;
  product:         string;
  user:            string;
  createdDate:     string; // use ISO‐string on front end
  agent:           string;
  itemDescription?: string;
  status:
    | "Project-Created"
    | "Shipped"
    | "Received"
    | "Receiving-log send"
    | "Auditing"
    | "Completed"
    | "On-hold"
    | "Cancelled";
}
