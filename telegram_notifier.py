"""
TELEGRAM REMOTE NOTIFICATION SYSTEM
Push notifications to Telegram for mission events

Author: Hermes the Boss
"""

import requests
import json
import os
from typing import Optional, Dict, List
from datetime import datetime
import threading

class TelegramNotifier:
    """Send notifications to Telegram chat."""
    
    def __init__(self, bot_token: Optional[str] = None, chat_id: Optional[str] = None):
        self.bot_token = bot_token
        self.chat_id = chat_id
        self.enabled = False
        self.base_url = "https://api.telegram.org/bot"
        
        # Try to load from environment or use defaults
        self._load_config()
    
    def _load_config(self):
        """Load configuration from file or environment."""
        try:
            # Try to load from config file
            if os.path.exists('telegram_config.json'):
                with open('telegram_config.json', 'r') as f:
                    config = json.load(f)
                    self.bot_token = config.get('bot_token')
                    self.chat_id = config.get('chat_id')
                    if self.bot_token and self.chat_id:
                        self.enabled = True
                        print(f"✅ Telegram configured successfully")
        except Exception:
            pass
        
        # Or try environment variables
        if not self.enabled:
            self.bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
            self.chat_id = os.getenv('TELEGRAM_CHAT_ID')
            if self.bot_token and self.chat_id:
                self.enabled = True
                print(f"✅ Telegram configured from environment variables")
    
    def _check_config(self) -> bool:
        """Check if Telegram is properly configured."""
        if not self.enabled or not self.bot_token or not self.chat_id:
            return False
        return True
    
    def send_message(self, message: str, parse_mode: str = "HTML") -> bool:
        """Send a text message to Telegram."""
        if not self._check_config():
            print("❌ Telegram not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID")
            return False
        
        url = f"{self.base_url}{self.bot_token}/sendMessage"
        
        payload = {
            'chat_id': self.chat_id,
            'text': message,
            'parse_mode': parse_mode
        }
        
        try:
            response = requests.post(url, json=payload, timeout=10)
            return response.status_code == 200
        except Exception as e:
            print(f"❌ Telegram error: {e}")
            return False
    
    def notify_task_start(self, agent_name: str, task: str) -> bool:
        """Notify when task starts."""
        message = f"🚀 <b>{agent_name}</b> starting task:<br>{task}"
        return self.send_message(message)
    
    def notify_task_complete(self, agent_name: str, task: str) -> bool:
        """Notify when task completes."""
        message = f"✅ <b>{agent_name}</b> completed:<br>{task}"
        return self.send_message(message)
    
    def notify_error(self, agent_name: str, error: str) -> bool:
        """Notify about an error."""
        message = f"🔴 <b>ERROR:</b><br>Agent {agent_name}: {error}"
        return self.send_message(message, parse_mode="HTML")
    
    def notify_delegation(self, message: str) -> bool:
        """Notify about delegation."""
        return self.send_message(f"📤 <b>DELEGATION:</b><br>{message}")
    
    def notify_spawn_agent(self, agent_type: str) -> bool:
        """Notify about new agent spawn."""
        message = f"🎯 <b>NEW AGENT:</b><br>Spawned {agent_type}"
        return self.send_message(message)
    
    def notify_mission_start(self, mission_name: str = "Unknown") -> bool:
        """Notify mission start."""
        message = f"🎮 <b>MISSION CONTROL ONLINE</b><br>Mission: {mission_name}"
        return self.send_message(message)
    
    def notify_mission_complete(self) -> bool:
        """Notify mission complete."""
        message = f"🏆 <b>MISSION COMPLETE</b><br>All objectives achieved!"
        return self.send_message(message)
    
    def send_photo(self, photo_path: str, caption: str = "") -> bool:
        """Send a photo with caption."""
        if not self._check_config():
            return False
        
        url = f"{self.base_url}{self.bot_token}/sendPhoto"
        
        with open(photo_path, 'rb') as f:
            files = {'photo': f}
            data = {'chat_id': self.chat_id}
            if caption:
                data['caption'] = caption
            
            try:
                response = requests.post(url, files=files, data=data, timeout=30)
                return response.status_code == 200
            except Exception as e:
                print(f"❌ Telegram photo error: {e}")
                return False
    
    def get_updates(self, timeout: int = 30) -> List[Dict]:
        """Get recent updates from bot."""
        if not self._check_config():
            return []
        
        url = f"{self.base_url}{self.bot_token}/getUpdates"
        
        try:
            response = requests.get(url, params={'timeout': timeout}, timeout=10)
            if response.status_code == 200:
                return response.json().get('result', [])
        except Exception as e:
            print(f"❌ Telegram updates error: {e}")
        
        return []
    
    def get_bot_info(self) -> Optional[Dict]:
        """Get bot info."""
        if not self._check_config():
            return None
        
        url = f"{self.base_url}{self.bot_token}/getMe"
        
        try:
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                return response.json().get('result', {})
        except Exception as e:
            print(f"❌ Telegram bot info error: {e}")
        
        return None
    
    def test_connection(self) -> bool:
        """Test Telegram connection."""
        if not self._check_config():
            return False
        
        return self.send_message("🔔 <b>Test Message</b><br>Mission Control - Telegram connected successfully!")


# Configuration helper
def create_telegram_config(bot_token: str, chat_id: str):
    """Create config file for Telegram."""
    config = {
        'bot_token': bot_token,
        'chat_id': chat_id
    }
    
    with open('telegram_config.json', 'w') as f:
        json.dump(config, f, indent=2)
    
    print(f"✅ Config saved to telegram_config.json")


# Usage example
if __name__ == '__main__':
    import os
    
    notifier = TelegramNotifier()
    
    # Check if configured
    if notifier.enabled:
        print("✅ Telegram configured!")
        
        # Test connection
        if notifier.test_connection():
            print("✅ Connection test successful!")
        else:
            print("❌ Connection test failed")
    else:
        print("❌ Telegram not configured")
        print("To configure:")
        print("1. Create bot via @BotFather on Telegram")
        print("2. Get bot token")
        print("3. Get your chat ID from @getmyid_bot")
        print("4. Run: create_telegram_config('YOUR_TOKEN', 'YOUR_CHAT_ID')")
