/**
 * Mission Control Dashboard - Main App Component
 * macOS Activity Monitor-style interface for AI agent monitoring
 * 
 * NOTE: This is a complete dashboard layout with all components inline.
 * The separate component files (AgentCard, LiveLogFeed, etc.) can be
 * used independently if preferred.
 */
import { useEffect, useState } from 'react';
import { useMissionControl } from './hooks/useMissionControl';
import { useDashboardStore } from './store/agentStore';
import { SystemMetrics, LogEntry } from './types';
import { Sun, Moon, Play, Pause, Square } from 'lucide-react';

// shadcn/ui style components (inline for now)
const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 ${className}`}>
    {children}
  </div>
);

const Button = ({ 
  children, 
  onClick, 
  variant = 'default',
  size = 'default',
  className = ''
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}) => {
  const base = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  const variants = {
    default: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
    outline: 'border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100',
    ghost: 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    default: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };
  return (
    <button onClick={onClick} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </button>
  );
};

const Badge = ({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'success' | 'warning' | 'error' }) => {
  const variants = {
    default: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
    success: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
    warning: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
    error: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
};

const AgentStatusBadge = ({ status }: { status: string }) => {
  const variants: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
    idle: 'default',
    thinking: 'warning',
    tool_call: 'warning',
    working: 'success',
    completed: 'success',
    error: 'error',
  };
  return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
};

const AgentCard = ({ agent }: { agent: Agent }) => {
  const getAgentStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      idle: 'bg-gray-400',
      thinking: 'bg-yellow-500',
      tool_call: 'bg-yellow-500',
      working: 'bg-blue-500',
      completed: 'bg-green-500',
      error: 'bg-red-500',
    };
    return colors[status] || 'bg-gray-400';
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">{agent.avatar || '🤖'}</span>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{agent.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{agent.role}</p>
          </div>
        </div>
        <AgentStatusBadge status={agent.status} />
      </div>
      
      {agent.current_task && (
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 truncate">
          📋 {agent.current_task}
        </p>
      )}
      
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>📊 {agent.progress}%</span>
        <span>{new Date(agent.last_active).toLocaleTimeString()}</span>
      </div>
      
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2">
        <div 
          className={`h-1.5 rounded-full transition-all duration-300 ${getAgentStatusColor(agent.status)}`}
          style={{ width: `${agent.progress}%` }}
        />
      </div>
    </Card>
  );
};

const LiveLogFeed = ({ logs }: { logs: LogEntry[] }) => {
  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-500 dark:text-red-400';
      case 'warning':
        return 'text-yellow-500 dark:text-yellow-400';
      case 'debug':
        return 'text-gray-500 dark:text-gray-400';
      default:
        return 'text-gray-800 dark:text-gray-200';
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'debug':
        return '🐛';
      default:
        return 'ℹ️';
    }
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 h-96 overflow-y-auto log-feed">
      <div className="p-4 space-y-2">
        {logs.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <p className="text-lg">No logs yet...</p>
            <p className="text-sm">Activity will appear here in real-time</p>
            <p className="text-xs mt-2">Total: 0 logs</p>
          </div>
        ) : (
          logs.map((log) => (
            <div 
              key={log.id} 
              className={`flex items-start space-x-2 text-sm p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${getLevelColor(log.level)}`}
            >
              <span className="text-xs opacity-70 min-w-[100px]">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span>{getLevelIcon(log.level)}</span>
              <span className="flex-1 font-medium">{log.message}</span>
              {log.agent_id && (
                <span className="text-xs opacity-60 min-w-[80px] text-right">
                  {log.agent_id}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

function App() {
  const { isConnected, connectionStatus, send, disconnect } = useMissionControl();
  const { agents, metrics, logs, clearLogs, setConnected } = useDashboardStore();
  const [darkMode, setDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState<'agents' | 'logs' | 'metrics'>('agents');
  const [filteredLogLevel, setFilteredLogLevel] = useState<'all' | 'info' | 'warning' | 'error' | 'debug'>('all');

  useEffect(() => {
    // Apply dark mode
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Sync connection state with store
  useEffect(() => {
    setConnected(isConnected);
  }, [isConnected, setConnected]);

  const filteredLogs = filteredLogLevel === 'all' 
    ? logs 
    : logs.filter(log => log.level === filteredLogLevel);

  const getAgentStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      idle: 'bg-gray-400',
      thinking: 'bg-yellow-500',
      tool_call: 'bg-yellow-500',
      working: 'bg-blue-500',
      completed: 'bg-green-500',
      error: 'bg-red-500',
    };
    return colors[status] || 'bg-gray-400';
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'dark' : ''} bg-gray-100 dark:bg-gray-900 transition-colors duration-200`}>
      {/* Top Navigation Bar */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              🚀 Mission Control
            </h1>
            <span className="text-sm text-gray-500 dark:text-gray-400">v1.0.0</span>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Connection Status */}
            <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg ${isConnected ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'}`}>
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            {/* Control Buttons */}
            <Button size="sm" variant="outline" onClick={() => send({ type: 'pause_all' })}>
              <Pause className="w-4 h-4 mr-1" /> Pause
            </Button>
            <Button size="sm" variant="outline" onClick={() => send({ type: 'resume_all' })}>
              <Play className="w-4 h-4 mr-1" /> Resume
            </Button>
            <Button size="sm" variant="outline" onClick={() => send({ type: 'kill_task' })}>
              <Square className="w-4 h-4 mr-1" /> Kill
            </Button>

            {/* Theme Toggle */}
            <Button 
              size="sm" 
              variant="ghost"
              onClick={() => setDarkMode(!darkMode)}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="p-6 space-y-6">
        {/* KPI Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Active Agents */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Active Agents</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {agents.filter(a => a.status !== 'idle').length} / {agents.length}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <span className="text-2xl">👥</span>
              </div>
            </div>
          </Card>

          {/* Tokens/sec */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Tokens/sec</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {metrics?.tokens_per_second?.toFixed(1) || '0.0'}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                <span className="text-2xl">⚡</span>
              </div>
            </div>
          </Card>

          {/* Total Tokens */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Tokens</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {metrics?.total_tokens_used?.toLocaleString() || '0'}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <span className="text-2xl">📊</span>
              </div>
            </div>
          </Card>

          {/* Uptime */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Uptime</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {metrics ? formatDuration(metrics.uptime_seconds) : '--:--'}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center">
                <span className="text-2xl">⏱️</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <Card>
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-4 px-6">
              <button
                onClick={() => setActiveTab('agents')}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'agents'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                All Agents
              </button>
              <button
                onClick={() => setActiveTab('metrics')}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'metrics'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                System Metrics
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'logs'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                Live Logs
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'agents' && (
              <div className="space-y-4">
                {/* Agent List */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {agents.map((agent) => (
                    <Card key={agent.id} className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">{agent.avatar || '🤖'}</span>
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">{agent.name}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{agent.role}</p>
                          </div>
                        </div>
                        <AgentStatusBadge status={agent.status} />
                      </div>
                      
                      {agent.current_task && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 truncate">
                          📋 {agent.current_task}
                        </p>
                      )}
                      
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>📊 {agent.progress}%</span>
                        <span>{new Date(agent.last_active).toLocaleTimeString()}</span>
                      </div>
                      
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2">
                        <div 
                          className={`h-1.5 rounded-full transition-all duration-300 ${getAgentStatusColor(agent.status)}`}
                          style={{ width: `${agent.progress}%` }}
                        />
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'metrics' && (
              <div className="space-y-6">
                {/* Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg p-4 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm opacity-90">Active Agents</p>
                        <p className="text-2xl font-bold mt-1">{metrics?.active_agents || 0}</p>
                      </div>
                      <div className="text-3xl">👥</div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-lg p-4 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm opacity-90">Total Agents</p>
                        <p className="text-2xl font-bold mt-1">{metrics?.total_agents || 0}</p>
                      </div>
                      <div className="text-3xl">🤖</div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg p-4 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm opacity-90">Tokens/sec</p>
                        <p className="text-2xl font-bold mt-1">{metrics?.tokens_per_second?.toFixed(1) || '0.0'}</p>
                      </div>
                      <div className="text-3xl">⚡</div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-green-500 to-green-700 rounded-lg p-4 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm opacity-90">Total Tokens</p>
                        <p className="text-2xl font-bold mt-1">{metrics?.total_tokens_used?.toLocaleString() || '0'}</p>
                      </div>
                      <div className="text-3xl">📊</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'logs' && (
              <div className="space-y-4">
                {/* Log Filter */}
                <div className="flex items-center space-x-2">
                  <Button 
                    size="sm" 
                    variant={filteredLogLevel === 'all' ? 'default' : 'outline'}
                    onClick={() => setFilteredLogLevel('all')}
                  >
                    All
                  </Button>
                  <Button 
                    size="sm" 
                    variant={filteredLogLevel === 'info' ? 'default' : 'outline'}
                    onClick={() => setFilteredLogLevel('info')}
                  >
                    Info
                  </Button>
                  <Button 
                    size="sm" 
                    variant={filteredLogLevel === 'warning' ? 'default' : 'outline'}
                    onClick={() => setFilteredLogLevel('warning')}
                  >
                    Warning
                  </Button>
                  <Button 
                    size="sm" 
                    variant={filteredLogLevel === 'error' ? 'default' : 'outline'}
                    onClick={() => setFilteredLogLevel('error')}
                  >
                    Error
                  </Button>
                  <div className="flex-1" />
                  <Button size="sm" variant="ghost" onClick={clearLogs}>
                    Clear
                  </Button>
                </div>

                {/* Log Feed */}
                <LiveLogFeed logs={filteredLogs} />
              </div>
            )}
          </div>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-3">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Mission Control Dashboard</span>
          <span>Real-time WebSocket monitoring powered by FastAPI + React</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
