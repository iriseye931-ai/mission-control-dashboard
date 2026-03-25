"""
WebSocket manager for handling connections and broadcasting events
"""
from typing import Dict, Set, Any
from datetime import datetime
import asyncio
from fastapi import WebSocket, WebSocketDisconnect
from event_bus import event_bus
from models import AgentEvent, EventType


class WebSocketManager:
    """Manages WebSocket connections and broadcasts events"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.agent_connections: Dict[str, Set[WebSocket]] = {}
        self.subscribed_queues: Dict[str, asyncio.Queue] = {}
    
    async def connect(self, websocket: WebSocket, client_id: str):
        """Accept new WebSocket connection"""
        await websocket.accept()
        self.active_connections[client_id] = websocket
        self.subscribed_queues[client_id] = asyncio.Queue()
        
        # Subscribe this client's queue to event bus
        event_bus.subscribe_all(self._enqueue_event(client_id))
        
        # Start processing queue
        asyncio.create_task(self._process_queue(client_id))
    
    async def disconnect(self, websocket: WebSocket, client_id: str):
# Disconnect
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        if client_id in self.subscribed_queues:
            event_bus.unsubscribe_all(self._enqueue_event(client_id))
            del self.subscribed_queues[client_id]
        await websocket.close()
    
    async def _enqueue_event(self, client_id: str):
        """Return callback to enqueue events"""
        async def callback(event: AgentEvent):
            if client_id in self.subscribed_queues:
                await self.subscribed_queues[client_id].put(event)
        return callback
    
    async def _process_queue(self, client_id: str):
        """Process queued events and send to client"""
        while client_id in self.subscribed_queues:
            try:
                event = await asyncio.wait_for(
                    self.subscribed_queues[client_id].get(),
                    timeout=1.0
                )
                websocket = self.active_connections.get(client_id)
                if websocket:
                    await websocket.send_json(event.model_dump())
            except asyncio.TimeoutError:
                continue
            except WebSocketDisconnect:
                break
            except Exception as e:
                print(f"Error sending event to {client_id}: {e}")
    
    async def broadcast_to_all(self, event: AgentEvent):
        """Broadcast event to all connected clients"""
        data = event.model_dump()
        for client_id, websocket in list(self.active_connections.items()):
            try:
                await websocket.send_json(data)
            except Exception as e:
                print(f"Error broadcasting to {client_id}: {e}")
    
    def get_connected_count(self) -> int:
        """Get number of connected clients"""
        return len(self.active_connections)
    
    def get_agent_connections(self, agent_id: str) -> Set[WebSocket]:
        """Get websockets subscribed to specific agent"""
        return self.agent_connections.get(agent_id, set())


websocket_manager = WebSocketManager()
