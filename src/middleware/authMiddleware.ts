
import { Request, Response, NextFunction } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";

let JWKS: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS() {
  const authURL = process.env.BETTER_AUTH_URL;

  if (!authURL) {
    throw new Error("BETTER_AUTH_URL is missing from .env");
  }

  if (!JWKS) {
    JWKS = createRemoteJWKSet(
      new URL("/api/auth/jwks", authURL)
    );
  }

  return { JWKS, authURL };
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    name?: string;
  };
}

export async function verifyToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is required",
      });
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token",
      });
    }

    const { JWKS, authURL } = getJWKS();

const { payload } = await jwtVerify(token, JWKS, {
  issuer: authURL,
  audience: authURL,
  algorithms: ["EdDSA"],
});

    if (!payload.sub) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload",
      });
    }

    req.user = {
      id: payload.sub,
      email:
        typeof payload.email === "string"
          ? payload.email
          : undefined,
      name:
        typeof payload.name === "string"
          ? payload.name
          : undefined,
    };

    next();
  } catch (error) {
    console.error("JWT Verification Failed:", error);

    return res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token",
    });
  }
}
