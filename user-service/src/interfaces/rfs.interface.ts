export interface IRfs {
  rfsNumber: string;
  entity: string;
  user: string;
  branch: string;
  service: string;
  pickupType: string;
  address: string;
  preferredPickupDate: string;
  additionalComments?: string;
  status?: "Open" | "Void" | "Closed";
  suppliers: {
    readyToPickup: boolean;
    boxesQty: number;
    skidQty: number;
    gaylordQty: number;
    otherNotes?: string;
  };
  attachedFile?: string | null;
}
