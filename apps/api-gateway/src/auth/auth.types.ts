import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum UserRoleView {
  ADMIN = 'ADMIN',
  DOCTOR = 'DOCTOR',
  CUSTOMER = 'CUSTOMER',
}
registerEnumType(UserRoleView, { name: 'UserRole' });

@ObjectType('AuthUser', {
  description: 'Data profil publik user. Password tidak pernah dikembalikan.',
})
export class AuthUserView {
  @Field(() => String) id: string;
  @Field(() => String) email: string;
  @Field(() => String, { nullable: true }) name: string | null;
  @Field(() => String) createdAt: string;
  @Field(() => UserRoleView) role: UserRoleView;
}

@ObjectType('LoginResult', {
  description: 'Token akses dan profil user yang berhasil login.',
})
export class LoginResultView {
  @Field(() => String) accessToken: string;
  @Field(() => String) tokenType: string;
  @Field(() => Number) expiresIn: number;
  @Field(() => AuthUserView) user: AuthUserView;
}
