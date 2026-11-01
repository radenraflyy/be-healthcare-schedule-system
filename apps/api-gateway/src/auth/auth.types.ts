import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('AuthUser')
export class AuthUserView {
  @Field(() => String) id: string;
  @Field(() => String) email: string;
  @Field(() => String, { nullable: true }) name: string | null;
  @Field(() => String) createdAt: string;
}

@ObjectType('LoginResult')
export class LoginResultView {
  @Field(() => String) accessToken: string;
  @Field(() => String) tokenType: string;
  @Field(() => Number) expiresIn: number;
  @Field(() => AuthUserView) user: AuthUserView;
}
