export interface GraphqlRequestContext {
  headers?: { authorization?: string };
  observeUserId?: string;
}

export interface GraphqlResolverContext {
  req: GraphqlRequestContext;
  res: { setHeader(name: string, value: string): void };
}
