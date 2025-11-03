export interface CustomJwtPayload {
  id: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}
