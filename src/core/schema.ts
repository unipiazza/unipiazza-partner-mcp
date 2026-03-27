import * as z from "zod/v4";
import { Tool } from "@modelcontextprotocol/sdk/types.js";

type JsonSchemaProperty = {
  type?: string;
  description?: string;
  enum?: unknown[];
};

type JsonObjectSchema = {
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
};

function toZodPropertySchema(property: JsonSchemaProperty) {
  let schema: z.ZodType;

  switch (property.type) {
    case "boolean":
      schema = z.boolean();
      break;
    case "number":
      schema = z.number();
      break;
    case "string":
    default:
      schema = z.string();
      break;
  }

  if (
    property.type === "string" &&
    Array.isArray(property.enum) &&
    property.enum.length > 0 &&
    property.enum.every((value): value is string => typeof value === "string")
  ) {
    const [firstValue, ...otherValues] = property.enum;
    schema = z.enum([firstValue, ...otherValues]);
  }

  if (property.description) {
    schema = schema.describe(property.description);
  }

  return schema;
}

export function createToolInputShape(tool: Tool) {
  const inputSchema = (tool.inputSchema ?? {}) as JsonObjectSchema;
  const properties = inputSchema.properties ?? {};
  const requiredProperties = new Set(inputSchema.required ?? []);

  return Object.fromEntries(
    Object.entries(properties).map(([name, property]) => {
      const schema = toZodPropertySchema(property);
      return [
        name,
        requiredProperties.has(name) ? schema : schema.optional(),
      ];
    }),
  );
}
