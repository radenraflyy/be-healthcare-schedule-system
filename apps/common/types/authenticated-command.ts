export interface AuthenticatedCommand<TInput> {
  token: string;
  input: TInput;
}

export interface AuthenticatedResult<TResult> {
  data: TResult;
  userId: string;
}
