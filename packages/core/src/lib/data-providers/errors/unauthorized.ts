export class UnauthorizedError {
  public readonly code = 401;
  public readonly message = 'Unauthorized';

  constructor(public readonly response: any) {}
}
