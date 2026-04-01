"""
Agent simulator for generating demo events
"""
import asyncio
import random
from datetime import datetime, timedelta
import sys
sys.path.append('/Users/iris/Projects/mission-control-dashboard/backend')

from models import AgentEvent, EventType, AgentStatus, LogEntry
from event_bus import event_bus


class AgentSimulator:
    """Simulates agent activity for demo purposes"""
    
    def __init__(self):
        self.agents = [
            {"id": "agent_1", "name": "Researcher", "role": "Researcher", "avatar": "🔍"},
            {"id": "agent_2", "name": "Writer", "role": "Writer", "avatar": "✍️"},
            {"id": "agent_3", "name": "Critic", "role": "Critic", "avatar": "⚖️"},
            {"id": "agent_4", "name": "ToolUser", "role": "Tool User", "avatar": "🛠️"},
            {"id": "agent_5", "name": "Analyst", "role": "Analyst", "avatar": "📊"},
        ]
        self.tasks = [
            "Researching topic", "Writing article", "Reviewing content",
            "Running analysis", "Testing function", "Debugging code",
            "Generating report", "Optimizing performance", "Validating data",
            "Creating visualization", "Compiling results", "Finalizing draft"
        ]
        self.thoughts = [
            "Analyzing the requirements...",
            "Considering alternative approaches...",
            "Checking consistency with previous work...",
            "Verifying data sources...",
            "Evaluating potential issues...",
            "Planning next steps...",
            "Cross-referencing information...",
            "Optimizing the solution...",
        ]
        self.tools = ["web_search", "code_execution", "file_read", "database_query", "api_call"]
    
    async def start(self):
        """Start the simulator"""
        print("🎭 Agent Simulator started - generating events...")
        
        while True:
            await self._simulate_cycle()
            await asyncio.sleep(random.uniform(1, 3))
    
    async def _simulate_cycle(self):
        """Run one simulation cycle"""
        # Pick random agent
        agent = random.choice(self.agents)
        
        # Pick random action
        action = random.choice([
            "thought", "tool_call", "task_progress", "output", "status_change"
        ])
        
        if action == "thought":
            await self._emit_thought(agent)
        elif action == "tool_call":
            await self._emit_tool_call(agent)
        elif action == "task_progress":
            await self._emit_progress(agent)
        elif action == "output":
            await self._emit_output(agent)
        elif action == "status_change":
            await self._emit_status_change(agent)
    
    async def _emit_thought(self, agent: dict):
        """Emit a thought event"""
        thought = random.choice(self.thoughts)
        event = AgentEvent(
            event_type=EventType.THOUGHT,
            source=agent["name"],
            data={
                "agent_id": agent["id"],
                "thought": thought,
                "confidence": random.uniform(0.7, 1.0)
            }
        )
        await event_bus.publish(event)
        print(f"🧠 {agent['name']}: {thought}")
    
    async def _emit_tool_call(self, agent: dict):
        """Emit a tool call event"""
        tool = random.choice(self.tools)
        event = AgentEvent(
            event_type=EventType.TOOL_CALL,
            source=agent["name"],
            data={
                "agent_id": agent["id"],
                "tool": tool,
                "arguments": {"query": f"sample_{random.randint(1,100)}"},
                "status": "pending"
            }
        )
        await event_bus.publish(event)
        
        # Simulate tool result after delay
        await asyncio.sleep(0.5)
        result_event = AgentEvent(
            event_type=EventType.TOOL_RESULT,
            source=agent["name"],
            data={
                "agent_id": agent["id"],
                "tool": tool,
                "result": f"Result from {tool}",
                "status": "completed"
            }
        )
        await event_bus.publish(result_event)
        print(f"🛠️  {agent['name']}: Used {tool}")
    
    async def _emit_progress(self, agent: dict):
        """Emit a progress update"""
        progress = random.randint(10, 90)
        task = random.choice(self.tasks)
        event = AgentEvent(
            event_type=EventType.PROGRESS_UPDATE,
            source=agent["name"],
            data={
                "agent_id": agent["id"],
                "task": task,
                "progress": progress,
                "estimated_remaining": random.randint(10, 60)
            }
        )
        await event_bus.publish(event)
        print(f"📈 {agent['name']}: {task} - {progress}%")
    
    async def _emit_output(self, agent: dict):
        """Emit output chunk"""
        output = f"Generated content snippet {random.randint(1,100)}"
        event = AgentEvent(
            event_type=EventType.OUTPUT_CHUNK,
            source=agent["name"],
            data={
                "agent_id": agent["id"],
                "content": output,
                "chunk_size": len(output)
            }
        )
        await event_bus.publish(event)
        print(f"💬 {agent['name']}: {output[:50]}...")
    
    async def _emit_status_change(self, agent: dict):
        """Emit status change"""
        status = random.choice([
            AgentStatus.THINKING,
            AgentStatus.WORKING,
            AgentStatus.TOOL_CALL,
            AgentStatus.IDLE
        ])
        event = AgentEvent(
            event_type=EventType.TASK_ASSIGNED,
            source=agent["name"],
            data={
                "agent_id": agent["id"],
                "status": status.value,
                "task": random.choice(self.tasks)
            }
        )
        await event_bus.publish(event)
        print(f"🔄 {agent['name']}: Status → {status.value}")


if __name__ == "__main__":
    simulator = AgentSimulator()
    asyncio.run(simulator.start())
