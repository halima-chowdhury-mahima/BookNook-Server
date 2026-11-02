
import {
  Request,
  Response,
  NextFunction,
} from "express";

import {
  createRemoteJWKSet,
  jwtVerify,
} from "jose";

let JWKS: ReturnType<typeof createRemoteJWKSet> | null = null;
let configuredAuthURL: string | null = null;

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    name?: string;
  };
}

function getJWKS() {
  const authURL = process.env.BETTER_AUTH_URL?.trim();

  if (!authURL) {
    throw new Error("BETTER_AUTH_URL is missing from environment variables");
  }

  if (configuredAuthURL !== authURL || !JWKS) {
    const normalizedURL = authURL.replace(/\/+$/, "");

    JWKS = createRemoteJWKSet(
      new URL("/api/auth/jwks", normalizedURL)
    );

    configuredAuthURL = authURL;
  }

  return {
    JWKS,
    authURL: authURL.replace(/\/+$/, ""),
  };
}

export async function verifyToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authorization = req.headers.authorization;

  if (!authorization) {
    res.status(401).json({
      success: false,
      message: "Authentication token is required",
    });
    return;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    res.status(401).json({
      success: false,
      message: "Invalid authorization header format",
    });
    return;
  }

  const token = match[1].trim();

  if (!token) {
    res.status(401).json({
      success: false,
      message: "Authentication token is empty",
    });
    return;
  }

  try {
    const { JWKS, authURL } = getJWKS();

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: authURL,
      audience: authURL,
      algorithms: ["EdDSA"],
    });

    if (
      typeof payload.sub !== "string" ||
      !payload.sub.trim()
    ) {
      res.status(401).json({
        success: false,
        message: "Invalid token payload",
      });
      return;
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

    if (
      error instanceof Error &&
      error.message.includes("BETTER_AUTH_URL is missing")
    ) {
      res.status(500).json({
        success: false,
        message: "Authentication service is not configured",
      });
      return;
    }

    res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token",
    });
  }
}
