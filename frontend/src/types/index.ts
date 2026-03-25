// Shapes match what the backend actually sends

export interface Agent {
  id: string
  name: string
  label?: string
  avatar?: string
  status: string
  model?: string
  last_active?: string
  program?: string
  host?: string
  address?: string
  task?: string
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

export interface MeshLogs {
  mlx: string[]
  memory: string[]
}

export interface StatusUpdate {
  type: 'status_update'
  timestamp?: string
  agents?: Agent[]
  services?: Record<string, ServiceHealth>
  cron_jobs?: CronJob[]
  memories?: MemoryEntry[]
  llm_active?: string | null
  voice_active?: boolean
  system?: SystemMetrics
  memory_monitor_log?: string[]
  logs?: MeshLogs
  amp_messages?: AmpMessage[]
  hermes_status?: HermesStatus
}
