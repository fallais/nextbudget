/** An opaque, DB-backed session token. */
export interface SessionRow {
  id: string;
  userId: number;
  expiresAt: Date;
}
