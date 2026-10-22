import { z } from "zod";

export const HealthReason = z.enum(["DATABASE_UNAVAILABLE", "NOT_CONFIGURED"]);
export const HealthStatus = z.enum(["ok", "unavailable"]);
export type HealthStatus = z.infer<typeof HealthStatus>;

export const HealthResponse = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal(HealthStatus.enum.ok) }),
  z.strictObject({
    status: z.literal(HealthStatus.enum.unavailable),
    reason: HealthReason,
  }),
]);
export type HealthResponse = z.infer<typeof HealthResponse>;
