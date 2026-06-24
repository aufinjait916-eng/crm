export type UserRole = "admin" | "management" | "manager" | "executive";
export type TaskType = string;
export type TaskStatus = "pending" | "completed";
export type InputType = "text" | "number" | "dropdown" | "checkbox" | "radio" | "datetime";

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  manager_id?: number | null;
}

export interface Client {
  id: number;
  contact_name: string;
  company_name: string;
  phone?: string;
  email?: string;
  address?: string;
  country?: string;
  zone?: string;
  state?: string;
  city?: string;
  created_at: string;
}

export interface Task {
  id: number;
  client_id: number;
  assigned_by: number;
  assigned_to: number;
  task_type: TaskType;
  scheduled_at: string;
  scheduled_end_at?: string; // Auto-calculated scheduled end time
  status: TaskStatus;
  completed_at?: string | null;
  created_at: string;
  voice_url?: string | null; // Path to voice recording
  comments?: string | null; // Outcomes, schedule comments, or closure notes
  // Included fields for convenience in front-end
  client_name?: string;
  company_name?: string;
  assignee_name?: string;
  creator_name?: string;
}

export interface QuestionnaireTemplate {
  id: number;
  name: string;
  description?: string | null;
}

export interface SessionType {
  id: number;
  name: string;
  label: string;
  template_id?: number | null; // associated questionnaire template
}

export interface FormQuestion {
  id: number;
  question_text: string;
  input_type: InputType;
  options?: string[] | null; // e.g. ["Choice A", "Choice B"]
  is_required: boolean;
  is_active: boolean;
  session_type_id?: number | null; // attached to a particular session type
  template_id?: number | null; // attached to a questionnaire template
}

export interface SubmissionAnswer {
  question_id: number;
  answer_value: string;
}

export interface TaskSubmissionPayload {
  answers: SubmissionAnswer[];
}

export interface ExecutiveMetric {
  id: number;
  name: string;
  completed_tasks: number;
  pending_tasks: number;
}

export interface ManagerAnalytics {
  total_completed_visits: number;
  total_completed_calls: number;
  total_pending_tasks: number;
  executive_performance: ExecutiveMetric[];
}

export interface PostgresConfig {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean;
}

