export interface UserPayload {
  id: string;
  name?: string;
  profile_image?: string;
  email?: string;
  countryCode?: string;
  mobileNumber?: string;
  isEmailVerified?: boolean;
  role: {
    key_value: string;
    role_id: string | null;
  }[];
}
