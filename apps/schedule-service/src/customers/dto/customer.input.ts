export interface CustomerInput {
  name?: string;
  email?: string;
  userId?: string | null;
  phone?: string | null;
  gender?: string | null;
  birthDate?: string | Date | null;
  address?: string | null;
  treatment?: string | null;
  status?: 'ACTIVE' | 'WAITING' | 'COMPLETED' | null;
  nextVisit?: string | Date | null;
  note?: string | null;
}
