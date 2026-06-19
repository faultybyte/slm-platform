/**
 * Types mirrored from openapi.json components.schemas.
 * Keep in sync with the backend spec — this file is the single source of
 * truth for request/response shapes used across the app.
 */

export interface UserCreate {
  email: string;
  password: string;
}

export interface UserResponse {
  id: number;
  email: string;
  created_at: string;
}

export interface Token {
  access_token: string;
  token_type: string;
}

export interface AuthMeResponse {
  id: number;
  email: string;
  created_at: string;
  /** Token consumption telemetry shown in the Navbar. Backend shape is loose
   * (schema: {}), so we keep this optional and defensive on read. */
  tokens_used?: number;
  token_limit?: number;
}

export interface ValidationErrorItem {
  loc: (string | number)[];
  msg: string;
  type: string;
}

export interface HTTPValidationError {
  detail: ValidationErrorItem[];
}

export interface ApiErrorShape {
  status: number;
  message: string;
  fieldErrors?: Record<string, string>;
}

/**
 * ASSUMED SHAPES — the backend declares these response schemas as {} in
 * openapi.json, so the exact field names below are inferred from the
 * architecture doc, not the spec. Update once confirmed against the real
 * backend; the rest of the app only reads through these types, so fixing
 * a field name here propagates everywhere.
 */

export type ModelStatus =
  | "pending"
  | "training"
  | "completed"
  | "failed"
  | "ready";

export interface ModelSummary {
  id: number;
  display_name: string;
  base_model_key: string;
  status: ModelStatus;
  created_at: string;
  dataset_id?: number;
}

export interface ConversationSummary {
  id: number;
  title: string;
  model_id?: number;
  updated_at: string;
  created_at: string;
}

export interface ConversationMessage {
  id?: number;
  role: "user" | "assistant" | "system";
  content: string;
  created_at?: string;
}
