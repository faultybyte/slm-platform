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

export type ModelStatus = "PENDING" | "TRAINING" | "PAUSED" | "COMPLETED" | "FAILED" | "READY";

export interface ModelSummary {
  id: number;
  display_name: string;
  base_model_key: string;
  status: ModelStatus;
  is_base_model?: boolean;
  /** True when the model was directly uploaded by the user (not fine-tuned). */
  is_uploaded?: boolean;
  created_at: string;
  dataset_id?: number;
  /** Optional: backend may return the dataset filename inline. */
  dataset_name?: string;
  /** Optional parameter count e.g. "1.7B" */
  parameter_count?: string;
  /** Optional description */
  description?: string;
}

export interface ConversationSummary {
  conversation_id: number;
  title: string;
  model_id?: number;
  /** Optional pin flag persisted by the backend */
  pinned?: boolean;
  updated_at: string;
  created_at: string;
}

export interface ConversationMessage {
  id?: number;
  role: "user" | "assistant" | "system";
  content: string;
  created_at?: string;
}

export interface CreateConversationRequest {
  model_id: number;
  session_title: string;
}

export interface DatasetSummary {
  id: number;
  filename: string;
  file_path: string;
  uploaded_at: string;
  row_count?: number;
}

export interface RegisterModelRequest {
  display_name: string;
  dataset_id: number;
  base_model_key?: string;
}

export interface TrainingParams {
  numEpochs?: number;
  learningRate?: number;
  batchSize?: number;
  warmupSteps?: number;
  maxSeqLength?: number;
}