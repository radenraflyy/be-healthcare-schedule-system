export interface PageInput {
  page?: number;
  limit?: number;
}

export interface Page<TResult> {
  items: TResult[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
