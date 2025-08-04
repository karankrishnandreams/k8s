export interface IRepository {
  amsNo: string;
  entity: string;
  branch: string;
  agent: string;
  reportType: "Receiving Log" | "Direction log" | "Audit Report" | "COD" | "Others";
  uploadedDate: string; // ISO string
  comments?: string;
  filePath?: string; // ✅ now optional
  originalFileName?: string; // ✅ now optional
}

