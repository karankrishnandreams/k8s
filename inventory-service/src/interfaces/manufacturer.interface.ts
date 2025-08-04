export interface IManufacturer {
  manufacturer?: string;
  full_name: string;
  status?: "active" | "inactive";
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}
