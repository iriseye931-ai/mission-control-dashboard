import { useEffect, useRef } from 'react'
import { useDashboardStore } from '../store/dashboardStore'
import { StatusUpdate, MeshInsight } from '../types'

const WS_URL = '/ws'

export const useWebSocket = () => {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectDelayRef = useRef(1000)
  const unmountedRef = useRef(false)
  // stable ref to connect so onclose can call it without stale closure issues
  const connectRef = useRef<() => void>(() => {})

  connectRef.current = () => {
    if (unmountedRef.current) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${protocol}//${window.location.host}${WS_URL}`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      if (unmountedRef.current) return
      const { setConnected, setLastUpdate } = useDashboardStore.getState()
      setConnected(true)
      setLastUpdate(new Date())
      reconnectDelayRef.current = 1000
    }

    ws.onmessage = (event) => {
      if (unmountedRef.current) return
      try {
        const msg = JSON.parse(event.data)
        const { setAgents, setServices, setCronJobs, setMemories, setLastUpdate, setLlmActive, setVoiceActive, setSystem, setMemoryMonitorLog, setLogs, setAmpMessages, setHermesStatus, setTrendingRepos, addInsight, setInsights } =
          useDashboardStore.getState()
        setLastUpdate(new Date())

        if (msg.type === 'insight') {
          addInsight(msg.insight as MeshInsight)
          return
        }

        if (msg.type === 'status_update') {
          const su = msg as StatusUpdate
          if (su.agents) setAgents(su.agents)
          if (su.services) setServices(su.services)
          if (su.cron_jobs) setCronJobs(su.cron_jobs)
          if (su.memories) setMemories(su.memories)
          if (su.llm_active !== undefined) setLlmActive(su.llm_active ?? null)
          if (su.voice_active !== undefined) setVoiceActive(su.voice_active)
          if (su.system) setSystem(su.system)
          if (su.memory_monitor_log) setMemoryMonitorLog(su.memory_monitor_log)
          if (su.logs) setLogs(su.logs)
          if (su.amp_messages) setAmpMessages(su.amp_messages)
          if (su.hermes_status) setHermesStatus(su.hermes_status)
          if (su.trending_repos) setTrendingRepos(su.trending_repos)
          if (su.insights) setInsights(su.insights)
        }
      } catch {
        // malformed message — ignore
      }
    }

    ws.onerror = () => {
      // handled by onclose
    }

    ws.onclose = () => {
      if (unmountedRef.current) return
      useDashboardStore.getState().setConnected(false)

      const delay = Math.min(reconnectDelayRef.current, 30000)
      reconnectDelayRef.current = Math.min(delay * 2, 30000)

      reconnectTimeoutRef.current = setTimeout(() => {
        connectRef.current()
      }, delay)
    }
  }

  useEffect(() => {
    unmountedRef.current = false
    connectRef.current()

    return () => {
      unmountedRef.current = true
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      wsRef.current?.close()
    }
  }, []) // intentionally empty — connect logic lives in connectRef

  const isConnected = useDashboardStore((s) => s.isConnected)
  const lastUpdate = useDashboardStore((s) => s.lastUpdate)

  return { isConnected, lastUpdate }
}
