import { SignJWT, jwtVerify } from "jose";

function getSecret() {
  return new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-in-production");
}


export const COOKIE_NAME = "sc-auth-token";

export interface TokenPayload {
  id: string;
  email: string;
  name: string;
  role: string;
  can_download: boolean;
  access_start_hour?: number;
  access_end_hour?: number;
}

export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  return payload as unknown as TokenPayload;
}
