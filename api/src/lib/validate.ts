import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import type { ZodType } from "zod";

/** zValidator that answers with the same `{ error }` envelope as the rest of the API. */
export function validate<
  Target extends keyof ValidationTargets,
  Schema extends ZodType,
>(target: Target, schema: Schema) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      const issue = result.error.issues[0];
      const field = issue?.path.join(".");
      return c.json(
        {
          error: field
            ? `${field}: ${issue?.message}`
            : (issue?.message ?? "Requisição inválida."),
        },
        400,
      );
    }
  });
}
