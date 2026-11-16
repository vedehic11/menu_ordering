const DEVELOPMENT_SECRET = "my-oh-my-local-development-secret-change-before-deploy";

export function getStaffJwtSecret(): Uint8Array {
  const secret = process.env.STAFF_JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("STAFF_JWT_SECRET must be configured in production.");
    }
    return new TextEncoder().encode(DEVELOPMENT_SECRET);
  }
  if (secret.length < 32) {
    throw new Error("STAFF_JWT_SECRET must be at least 32 characters long.");
  }
  return new TextEncoder().encode(secret);
}
