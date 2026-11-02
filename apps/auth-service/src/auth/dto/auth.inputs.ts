export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface TokenInput {
  token: string;
}

export type UserRole = 'ADMIN' | 'DOCTOR' | 'CUSTOMER';

export interface SetUserRoleInput {
  token: string;
  userId: string;
  role: UserRole;
}

export interface CreateManagedUserInput {
  token: string;
  email: string;
  password: string;
  name?: string;
  role: UserRole;
}
