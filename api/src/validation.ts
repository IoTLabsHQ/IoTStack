/**
 * Runtime type guards for request fields.
 *
 * `req.body as {...}` is a compile-time-only assertion — it does not stop a
 * caller from sending a non-string value where a string is expected. Call
 * these at the top of any route handler before a body field is used.
 */
import { Response } from "express";

export class ValidationError extends Error {}

export function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} must be a non-empty string`);
  }
  return value;
}

export function optionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new ValidationError(`${fieldName} must be a string`);
  }
  return value;
}

/** Returns true (and has already responded 400) if err was a ValidationError. */
export function respondIfValidationError(err: unknown, res: Response): boolean {
  if (err instanceof ValidationError) {
    res.status(400).json({ error: err.message });
    return true;
  }
  return false;
}
