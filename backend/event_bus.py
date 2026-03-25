"""
In-memory event bus for broadcasting events to WebSocket clients
"""
from typing import Dict, Set, Callable, Any
from datetime import datetime
import uuid
import asyncio
from models import AgentEvent, EventType


class EventBus:
    """Simple in-memory pub/sub event bus"""
    
    def __init__(self):
        self._subscribers: Dict[EventType, Set[Callable]] = {
            event_type: set() for event_type in EventType
        }
        self._all_subscribers: Set[Callable] = set()
        self._event_history: list[AgentEvent] = []
        self._max_history = 1000
    
    def subscribe(self, event_type: EventType, callback: Callable):
        """Subscribe to specific event type"""
        if event_type in self._subscribers:
            self._subscribers[event_type].add(callback)
    
    def subscribe_all(self, callback: Callable):
        """Subscribe to all event types"""
        self._all_subscribers.add(callback)
    
    def unsubscribe(self, event_type: EventType, callback: Callable):
        """Unsubscribe from event type"""
        if event_type in self._subscribers:
            self._subscribers[event_type].discard(callback)
    
    def unsubscribe_all(self, callback: Callable):
        """Unsubscribe from all event types"""
        self._all_subscribers.discard(callback)
    
    async def publish(self, event: AgentEvent):
        """Publish an event to all subscribers"""
        self._event_history.append(event)
        if len(self._event_history) > self._max_history:
            self._event_history = self._event_history[-self._max_history:]
        
        # Call specific event type subscribers
        if event.event_type in self._subscribers:
            for callback in self._subscribers[event.event_type]:
                try:
                    if asyncio.iscoroutinefunction(callback):
                        await callback(event)
                    else:
                        callback(event)
                except Exception as e:
                    print(f"Error in event callback: {e}")
        
        # Call all subscribers
        for callback in self._all_subscribers:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(event)
                else:
                    callback(event)
            except Exception as e:
                print(f"Error in event callback: {e}")
    
    def get_history(self, limit: int = 100) -> list[AgentEvent]:
        """Get recent event history"""
        return self._event_history[-limit:]
    
    def clear_history(self):
        """Clear event history"""
        self._event_history = []


event_bus = EventBus()
