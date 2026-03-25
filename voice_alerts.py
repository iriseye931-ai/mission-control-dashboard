"""
VOICE ALERT SYSTEM
Text-to-speech notifications for mission events

Author: Hermes the Boss
"""

import pyttsx2
import threading
import queue
from typing import Optional

class VoiceAlertSystem:
    """TTS notifications for mission events."""
    
    def __init__(self):
        self.engine = None
        self.queue = queue.Queue()
        self.enabled = True
        self.vol = 0.8
        self.rate = 150
        self._init_engine()
        self._start_listener_thread()
    
    def _init_engine(self):
        """Initialize the TTS engine."""
        try:
            self.engine = pyttsx2.init()
            self.engine.setProperty('volume', self.vol)
            self.engine.setProperty('rate', self.rate)
            self._test_voice()
        except Exception as e:
            print(f"⚠️ Voice system not available: {e}")
            self.engine = None
    
    def _test_voice(self):
        """Test the voice system."""
        if self.engine:
            voices = self.engine.getProperty('voices')
            print(f"🎤 Voice system initialized with {len(voices)} available voices")
    
    def _start_listener_thread(self):
        """Start thread to process voice queue."""
        def process_queue():
            while True:
                text = self.queue.get()
                if text is None:
                    break
                self._speak(text)
                self.queue.task_done()
        
        thread = threading.Thread(target=process_queue, daemon=True)
        thread.start()
    
    def _speak(self, text: str):
        """Actually speak the text."""
        if self.engine and self.enabled:
            self.engine.say(text)
            self.engine.runAndWait()
    
    def queue_message(self, message: str):
        """Queue a message to be spoken."""
        if self.enabled:
            self.queue.put(message)
    
    def notify_task_start(self, agent_name: str, task: str):
        """Notify when a task starts."""
        msg = f"{agent_name} starting: {task}"
        self.queue_message(msg)
    
    def notify_task_complete(self, agent_name: str, task: str):
        """Notify when a task completes."""
        msg = f"{agent_name} completed: {task}"
        self.queue_message(msg)
    
    def notify_error(self, agent_name: str, error: str):
        """Notify about an error."""
        msg = f"Error! {agent_name}: {error}"
        self.queue_message(msg)
    
    def notify_delegation(self, message: str):
        """Notify about a delegation."""
        self.queue_message(message)
    
    def toggle(self):
        """Enable/disable voice alerts."""
        self.enabled = not self.enabled
        return self.enabled


# Simple usage example
if __name__ == '__main__':
    voice = VoiceAlertSystem()
    voice.queue_message("Mission Control online!")
    voice.queue_message("Starting voice system test")
    
    import time
    time.sleep(5)
