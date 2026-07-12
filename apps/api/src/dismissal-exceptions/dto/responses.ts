export interface DismissalExceptionResponse {
  id: string;
  institutionId: string;
  date: string;
  name: string;
  level: string | null;
  time: string;
}

export interface ListDismissalExceptionsResponse {
  dismissalExceptions: DismissalExceptionResponse[];
}
