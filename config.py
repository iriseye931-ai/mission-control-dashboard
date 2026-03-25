"""
CONFIGURATION HELPER
Set up voice, export, and Telegram notifications
"""

import os
import json
import sys

def create_telegram_config():
    """Create Telegram config file."""
    print("=" * 60)
    print("SETUP TELEGRAM NOTIFICATIONS")
    print("=" * 60)
    print()
    print("To set up Telegram notifications:")
    print()
    print("1. Open Telegram and search for @BotFather")
    print("2. Send /newbot and follow instructions")
    print("3. You'll receive a BOT TOKEN")
    print()
    print("4. To get your chat ID:")
    print("   - Search for @userinfobot in Telegram")
    print("   - Start the bot and it will give you your ID")
    print()
    print("5. Enter your details below:")
    print()
    
    bot_token = input("Enter Bot Token: ").strip()
    chat_id = input("Enter Chat ID: ").strip()
    
    if bot_token and chat_id:
        config = {
            'bot_token': bot_token,
            'chat_id': chat_id
        }
        
        with open('telegram_config.json', 'w') as f:
            json.dump(config, f, indent=2)
        
        print()
        print("✅ Config saved to telegram_config.json")
        print("✅ Telegram notifications are now enabled!")
    else:
        print("❌ Invalid input. Config not saved.")

def create_voice_config():
    """Check voice system."""
    print("=" * 60)
    print("VOICE ALERTS SETUP")
    print("=" * 60)
    print()
    
    try:
        import pyttsx2
        engine = pyttsx2.init()
        voices = engine.getProperty('voices')
        
        print(f"✅ pyttsx2 installed!")
        print(f"🎤 Available voices: {len(voices)}")
        print()
        print("Voice alerts are ready to use!")
    except ImportError:
        print("❌ pyttsx2 not installed")
        print()
        print("Install with: pip3 install pyttsx2")
    except Exception as e:
        print(f"⚠️ Voice system issue: {e}")

def check_all_upgrades():
    """Check all upgrade availability."""
    print("=" * 60)
    print("UPGRADE STATUS CHECK")
    print("=" * 60)
    print()
    
    # Check voice
    try:
        import pyttsx2
        print("✅ Voice Alerts: READY (pyttsx2)")
    except ImportError:
        print("❌ Voice Alerts: NEEDS INSTALLATION (pip3 install pyttsx2)")
    
    # Check export
    print("✅ Log Export: READY (built-in)")
    
    # Check telegram
    try:
        import requests
        print("✅ Telegram: READY (requests)")
        
        # Check config
        if os.path.exists('telegram_config.json'):
            with open('telegram_config.json', 'r') as f:
                config = json.load(f)
                if config.get('bot_token') and config.get('chat_id'):
                    print("   ✅ Telegram: CONFIGURED")
                else:
                    print("   ⚠️ Telegram: CONFIG FILE EXISTING BUT INCOMPLETE")
        else:
            print("   ❌ Telegram: NO CONFIG FILE")
    except ImportError:
        print("❌ Telegram: NEEDS INSTALLATION (pip3 install requests)")
    
    print()
    print("To install missing dependencies:")
    print("   pip3 install pyttsx2 requests")

if __name__ == '__main__':
    if len(sys.argv) > 1:
        if sys.argv[1] == 'telegram':
            create_telegram_config()
        elif sys.argv[1] == 'voice':
            create_voice_config()
        else:
            check_all_upgrades()
    else:
        check_all_upgrades()
        print()
        print("Options:")
        print("   python3 config.py telegram  - Set up Telegram")
        print("   python3 config.py voice     - Check voice alerts")
        print("   python3 config.py           - Check all upgrades")
