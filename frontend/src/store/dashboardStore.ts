import { create } from 'zustand'
import { Agent, ServiceHealth, ServiceHistoryPoint, CronJob, MemoryEntry, Message, SystemMetrics, AmpMessage, HermesStatus, MeshLogs, TrendingRepo, MeshInsight } from '../types'

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

  // Service sparkline history
  serviceHistory: Record<string, ServiceHistoryPoint[]>

  // Trending
  trendingRepos: TrendingRepo[]

  // Subconscious insights
  insights: MeshInsight[]

  // Chat
  chatHistory: Message[]
  isChatLoading: boolean

  // Brief
  brief: string | null
  briefGeneratedAt: string | null

  // Actions
  setAgents: (agents: Agent[]) => void
  setServices: (services: Record<string, ServiceHealth>) => void
  setCronJobs: (jobs: CronJob[]) => void
  addMemory: (memory: MemoryEntry) => void
  setMemories: (memories: MemoryEntry[]) => void
  addChatMessage: (msg: Message) => void
  appendChatToken: (token: string) => void
  setChatLoading: (loading: boolean) => void
  setBrief: (text: string, generatedAt: string | null) => void
  setConnected: (connected: boolean) => void
  setLastUpdate: (date: Date) => void
  setLlmActive: (llmActive: string | null) => void
  setVoiceActive: (voiceActive: boolean) => void
  setSystem: (system: SystemMetrics) => void
  setMemoryMonitorLog: (lines: string[]) => void
  setLogs: (logs: MeshLogs) => void
  setAmpMessages: (messages: AmpMessage[]) => void
  setHermesStatus: (status: HermesStatus) => void
  setServiceHistory: (history: Record<string, ServiceHistoryPoint[]>) => void
  setTrendingRepos: (repos: TrendingRepo[]) => void
  addInsight: (insight: MeshInsight) => void
  setInsights: (insights: MeshInsight[]) => void
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

  serviceHistory: {},
  trendingRepos: [],
  insights: [],

  chatHistory: [],
  isChatLoading: false,

  brief: null,
  briefGeneratedAt: null,

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
  appendChatToken: (token) =>
    set((state) => {
      const history = [...state.chatHistory]
      if (history.length === 0) return {}
      const last = history[history.length - 1]
      if (last.role !== 'assistant') return {}
      history[history.length - 1] = { ...last, content: last.content + token }
      return { chatHistory: history }
    }),
  setChatLoading: (isChatLoading) => set({ isChatLoading }),
  setBrief: (text, generatedAt) => set({ brief: text, briefGeneratedAt: generatedAt }),
  setConnected: (isConnected) => set({ isConnected }),
  setLastUpdate: (lastUpdate) => set({ lastUpdate }),
  setLlmActive: (llmActive) => set({ llmActive }),
  setVoiceActive: (voiceActive) => set({ voiceActive }),
  setSystem: (system) => set({ system }),
  setMemoryMonitorLog: (memoryMonitorLog) => set({ memoryMonitorLog }),
  setLogs: (logs) => set({ logs }),
  setAmpMessages: (ampMessages) => set({ ampMessages }),
  setHermesStatus: (hermesStatus) => set({ hermesStatus }),
  setServiceHistory: (serviceHistory) => set({ serviceHistory }),
  setTrendingRepos: (trendingRepos) => set({ trendingRepos }),
  addInsight: (insight) => set((state) => ({ insights: [insight, ...state.insights].slice(0, 20) })),
  setInsights: (insights) => set({ insights }),
}))
