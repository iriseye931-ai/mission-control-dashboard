import { useEffect, useRef } from 'react'
import { useDashboardStore } from '../store/dashboardStore'
import { StatusUpdate } from '../types'

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
        const msg: StatusUpdate = JSON.parse(event.data)
        const { setAgents, setServices, setCronJobs, setMemories, setLastUpdate, setLlmActive, setVoiceActive, setSystem, setMemoryMonitorLog, setLogs, setAmpMessages, setHermesStatus } =
          useDashboardStore.getState()
        setLastUpdate(new Date())
        if (msg.type === 'status_update') {
          if (msg.agents) setAgents(msg.agents)
          if (msg.services) setServices(msg.services)
          if (msg.cron_jobs) setCronJobs(msg.cron_jobs)
          if (msg.memories) setMemories(msg.memories)
          if (msg.llm_active !== undefined) setLlmActive(msg.llm_active ?? null)
          if (msg.voice_active !== undefined) setVoiceActive(msg.voice_active)
          if (msg.system) setSystem(msg.system)
          if (msg.memory_monitor_log) setMemoryMonitorLog(msg.memory_monitor_log)
          if (msg.logs) setLogs(msg.logs)
          if (msg.amp_messages) setAmpMessages(msg.amp_messages)
          if (msg.hermes_status) setHermesStatus(msg.hermes_status)
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
