export class AuthError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "AuthError";
  }
}
