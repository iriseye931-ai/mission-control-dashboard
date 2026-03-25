"""
Pydantic models for the Mission Control Dashboard
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime


class AgentStatus(str, Enum):
    IDLE = "idle"
    THINKING = "thinking"
    TOOL_CALL = "tool_call"
    WORKING = "working"
    WAITING = "waiting"
    COMPLETED = "completed"
    ERROR = "error"


class EventType(str, Enum):
    AGENT_STARTED = "agent_started"
    AGENT_FINISHED = "agent_finished"
    TASK_ASSIGNED = "task_assigned"
    THOUGHT = "thought"
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"
    OUTPUT_CHUNK = "output_chunk"
    PROGRESS_UPDATE = "progress_update"
    ERROR_OCCURRED = "error_occurred"
    SYSTEM_METRIC = "system_metric"


class AgentEvent(BaseModel):
    """Base model for all agent events"""
    event_type: EventType
    timestamp: datetime = Field(default_factory=datetime.now)
    source: str  # Agent name or system component
    data: Dict[str, Any]


class AgentInfo(BaseModel):
    """Information about an agent"""
    id: str
    name: str
    role: str
    avatar: Optional[str] = None
    status: AgentStatus = AgentStatus.IDLE
    current_task: Optional[str] = None
    progress: int = 0  # 0-100
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    last_active: datetime = Field(default_factory=datetime.now)


class LogEntry(BaseModel):
    """Log entry from agents"""
    id: str
    timestamp: datetime = Field(default_factory=datetime.now)
    source: str
    message: str
    level: str = "info"  # info, warning, error, debug
    agent_id: Optional[str] = None


class SystemMetrics(BaseModel):
    """System-wide metrics"""
    active_agents: int = 0
    total_agents: int = 0
    total_tokens_used: int = 0
    tokens_per_second: float = 0.0
    total_cost: float = 0.0
    uptime_seconds: int = 0
    events_per_second: float = 0.0


class MissionProgress(BaseModel):
    """Overall mission progress"""
    mission_id: str
    mission_title: str
    description: str
    progress: int = 0
    started_at: datetime
    estimated_completion: Optional[datetime] = None
    sub_missions: List[Dict[str, Any]] = []


class EventTimelineItem(BaseModel):
    """Recent events for the timeline"""
    id: str
    event_type: EventType
    source: str
    message: str
    timestamp: datetime = Field(default_factory=datetime.now)
    priority: str = "normal"  # low, normal, high, critical
