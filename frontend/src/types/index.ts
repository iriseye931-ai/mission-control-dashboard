// Shapes match what the backend actually sends

export interface Agent {
  id: string
  name: string
  label?: string
  avatar?: string
  status: string
  runtime_status?: string
  registration_status?: string
  orchestration_status?: string
  health_status?: string
  orchestration_reachable?: boolean
  status_reason?: string | null
  activity_status?: string
  activity_age_seconds?: number | null
  recently_active?: boolean
  availability_status?: string
  availability_reason?: string | null
  tier?: string
  routing_group?: string
  scarce?: boolean
  default_for?: string[]
  reserve_for?: string[]
  fallback_to?: string | null
  model?: string
  last_active?: string
  program?: string
  host?: string
  address?: string
  task?: string
  presence?: {
    kind: string
    status: string
    reason?: string | null
  }
  local_profiles?: {
    name: string
    model: string
    model_path?: string
    base_url?: string
    purpose?: string
    mode?: string
    installed?: boolean
    running?: boolean
    startable?: boolean
    managed?: boolean
    port?: number
    pid?: number | null
    log_path?: string
  }[]
}

export interface ServiceHealth {
  name: string
  status: string  // "up" | "down" | "degraded"
  error?: string
  detail?: unknown
  models?: string[]
}

export interface CronJob {
  id: string
  name: string
  schedule_display?: string
  last_run_at?: string | null
  next_run_at?: string | null
  next_run_in_seconds?: number | null
  last_status?: string | null
  enabled?: boolean
  state?: string
  interval_seconds?: number | null
  prompt_snippet?: string | null
}

export interface MemoryEntry {
  id?: string
  text?: string
  score?: number
  // legacy fields (if populated by old REST path)
  timestamp?: string
  agent?: string
  content?: string
  tags?: string[]
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface SystemMetrics {
  cpu_pct: number
  ram_pct: number
  ram_used_gb: number
  ram_total_gb: number
  mlx_ram_pct: number
  mlx_ram_gb: number
  mlx_pid: number | null
  local_pct: number
}

export interface AmpMessage {
  id: string
  direction: 'inbox' | 'sent'
  from: string
  to: string
  subject: string
  body: string
  timestamp: string
  type: string
}

export interface HermesStatus {
  status: string
  session_id?: string
  model?: string
  task?: string
  created_at?: string
  modified?: number
}

export interface RoutingSummary {
  policy: string
  premium_pool: string[]
  premium_available: string[]
  premium_available_count: number
  premium_total_count: number
  local_default?: string
  specialized_agents: string[]
  guidance?: Record<string, string>
}

export interface PermissionAuditSummary {
  count: number
  decision_counts: Record<string, number>
  mode_counts: Record<string, number>
  last_event_at?: string | null
}

export interface PermissionAuditEntry {
  timestamp: string
  source: string
  agent?: string | null
  tool?: string | null
  decision: string
  mode: string
  reason?: string | null
  input_summary?: string | null
}

export interface MeshLogs {
  mlx: string[]
  memory: string[]
}

export interface MeshInsight {
  timestamp: string
  severity: 'info' | 'warning' | 'critical'
  summary: string
  insights: string[]
  actions: string[]
}

export interface TrendingRepo {
  id: number
  name: string
  description: string
  stars: number
  language: string | null
  url: string
  created_at: string
  topics: string[]
}

export interface ServiceHistoryPoint {
  ts: string
  up: boolean
}

export interface SessionEntry {
  ts: string
  role: string
  content: string
}

export interface StatusUpdate {
  type: 'status_update'
  timestamp?: string
  agents?: Agent[]
  services?: Record<string, ServiceHealth>
  service_history?: Record<string, ServiceHistoryPoint[]>
  cron_jobs?: CronJob[]
  memories?: MemoryEntry[]
  llm_active?: string | null
  voice_active?: boolean
  system?: SystemMetrics
  memory_monitor_log?: string[]
  logs?: MeshLogs
  amp_messages?: AmpMessage[]
  hermes_status?: HermesStatus
  routing_summary?: RoutingSummary
  permission_audit_summary?: PermissionAuditSummary
  trending_repos?: TrendingRepo[]
  insights?: MeshInsight[]
}
