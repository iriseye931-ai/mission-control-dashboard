import { create } from 'zustand'
import { Agent, ServiceHealth, CronJob, MemoryEntry, Message, SystemMetrics, AmpMessage, HermesStatus, MeshLogs } from '../types'

interface DashboardState {
  // Connection
  isConnected: boolean
  lastUpdate: Date | null

  // Data
  agents: Agent[]
  services: Record<string, ServiceHealth>
  cronJobs: CronJob[]
  memories: MemoryEntry[]
  system: SystemMetrics | null
  memoryMonitorLog: string[]
  logs: MeshLogs
  ampMessages: AmpMessage[]
  hermesStatus: HermesStatus | null

  // LLM / Voice
  llmActive: string | null
  voiceActive: boolean

  // Chat
  chatHistory: Message[]
  isChatLoading: boolean

  // Actions
  setAgents: (agents: Agent[]) => void
  setServices: (services: Record<string, ServiceHealth>) => void
  setCronJobs: (jobs: CronJob[]) => void
  addMemory: (memory: MemoryEntry) => void
  setMemories: (memories: MemoryEntry[]) => void
  addChatMessage: (msg: Message) => void
  setChatLoading: (loading: boolean) => void
  setConnected: (connected: boolean) => void
  setLastUpdate: (date: Date) => void
  setLlmActive: (llmActive: string | null) => void
  setVoiceActive: (voiceActive: boolean) => void
  setSystem: (system: SystemMetrics) => void
  setMemoryMonitorLog: (lines: string[]) => void
  setLogs: (logs: MeshLogs) => void
  setAmpMessages: (messages: AmpMessage[]) => void
  setHermesStatus: (status: HermesStatus) => void
}

export const useDashboardStore = create<DashboardState>((set) => ({
  isConnected: false,
  lastUpdate: null,

  agents: [],
  services: {},
  cronJobs: [],
  memories: [],
  system: null,
  memoryMonitorLog: [],
  logs: { mlx: [], memory: [] },
  ampMessages: [],
  hermesStatus: null,

  llmActive: null,
  voiceActive: false,

  chatHistory: [],
  isChatLoading: false,

  setAgents: (agents) => set({ agents }),
  setServices: (services) => set({ services }),
  setCronJobs: (cronJobs) => set({ cronJobs }),
  addMemory: (memory) =>
    set((state) => ({
      memories: [memory, ...state.memories].slice(0, 100),
    })),
  setMemories: (memories) => set({ memories }),
  addChatMessage: (msg) =>
    set((state) => ({ chatHistory: [...state.chatHistory, msg] })),
  setChatLoading: (isChatLoading) => set({ isChatLoading }),
  setConnected: (isConnected) => set({ isConnected }),
  setLastUpdate: (lastUpdate) => set({ lastUpdate }),
  setLlmActive: (llmActive) => set({ llmActive }),
  setVoiceActive: (voiceActive) => set({ voiceActive }),
  setSystem: (system) => set({ system }),
  setMemoryMonitorLog: (memoryMonitorLog) => set({ memoryMonitorLog }),
  setLogs: (logs) => set({ logs }),
  setAmpMessages: (ampMessages) => set({ ampMessages }),
  setHermesStatus: (hermesStatus) => set({ hermesStatus }),
}))
