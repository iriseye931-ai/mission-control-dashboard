"""
HERMES MISSION CONTROL - INTEGRATED UPGRADES
Full dashboard with Voice Alerts, Export, and Telegram notifications

Controls:
- S : Spawn new agent
- Q : Quit
- R : Refresh logs
- X : Export logs (all formats)
- E : Send Telegram test message
- V : Toggle voice alerts (on/off)

Author: Hermes the Boss
"""

import pygame
import sys
import os
import random
import time
from datetime import datetime
from typing import List, Optional

# Import upgraded modules
try:
    from voice_alerts_v2 import VoiceAlertSystem
    VOICE_AVAILABLE = True
except ImportError:
    VOICE_AVAILABLE = False
    print("⚠️ pyttsx3 not installed. Voice alerts disabled.")

try:
    from log_export import LogExporter
    EXPORT_AVAILABLE = True
except ImportError:
    EXPORT_AVAILABLE = False
    print("⚠️ Export module ready. Install required dependencies.")

try:
    from telegram_notifier import TelegramNotifier
    TELEGRAM_AVAILABLE = True
except ImportError:
    TELEGRAM_AVAILABLE = False
    print("⚠️ requests not installed. Telegram notifications disabled.")


# ==================== CONSTANTS ====================
SCREEN_WIDTH = 1200
SCREEN_HEIGHT = 800
FPS = 60

# Colors
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
DARK_BLUE = (10, 20, 50)
BLUE = (30, 60, 150)
CYAN = (0, 255, 255)
MAGENTA = (255, 0, 255)
GREEN = (0, 255, 0)
YELLOW = (255, 255, 0)
RED = (255, 0, 0)
ORANGE = (255, 150, 0)
GRAY = (100, 100, 100)
LIGHT_GRAY = (150, 150, 150)
NEON_BLUE = (0, 200, 255)
NEON_PINK = (255, 0, 150)
UPGRADE_GREEN = (0, 255, 150)  # New upgrades indicator

# Agent colors
AGENT_COLORS = {
    'Researcher': (100, 150, 255),
    'Coder': (150, 100, 255),
    'Tester': (255, 100, 100),
    'Writer': (100, 255, 150),
    'Designer': (255, 200, 100),
    'Analyst': (200, 100, 255),
}

# ==================== DATA CLASSES ====================

from dataclasses import dataclass
from enum import Enum

@dataclass
class Task:
    """Represents a task being performed."""
    name: str
    progress: int  # 0-100
    completed: bool = False
    started_at: Optional[str] = None
    
    def __post_init__(self):
        if self.started_at is None:
            self.started_at = datetime.now().strftime('%H:%M:%S')


class AgentStatus(Enum):
    IDLE = "Idle"
    WORKING = "Working"
    ERROR = "Error"
    COMPLETE = "Complete"


# ==================== ENHANCED LOG SYSTEM ====================

class LogFeed:
    """Enhanced log feed with export capability."""
    
    def __init__(self, max_entries: int = 50):
        self.entries: List[Dict] = []
        self.max_entries = max_entries
        self.font = pygame.font.Font(None, 20)
        self.bold_font = pygame.font.Font(None, 24)
        self.scroll_offset = 0
        
    def add_entry(self, source: str, message: str, log_type: str = "info"):
        """Add a new log entry."""
        entry = {
            'source': source,
            'message': message,
            'type': log_type,
            'timestamp': datetime.now().strftime('%H:%M:%S.%f')[:-3],
            'color': self._get_color(log_type)
        }
        self.entries.append(entry)
        
        if len(self.entries) > self.max_entries:
            self.entries.pop(0)
    
    def _get_color(self, log_type: str) -> tuple:
        colors = {
            'info': CYAN,
            'success': GREEN,
            'warning': YELLOW,
            'error': RED,
            'delegation': MAGENTA,
            'status': BLUE,
            'upgrade': UPGRADE_GREEN
        }
        return colors.get(log_type, WHITE)
    
    def draw(self, screen, x: int, y: int, width: int, height: int):
        """Draw the log feed panel."""
        pygame.draw.rect(screen, (20, 30, 50), (x, y, width, height), border_radius=8)
        pygame.draw.rect(screen, NEON_BLUE, (x, y, width, height), 2, border_radius=8)
        
        header = self.bold_font.render("MISSION LOGS", True, CYAN)
        screen.blit(header, (x + 15, y + 10))
        
        for i, entry in enumerate(self.entries[-25:]):
            line_y = y + 50 + i * 25
            if line_y + 25 > y + height:
                break
            
            source_color = entry['color']
            source_text = self.font.render(f"[{entry['timestamp']}] {entry['source']}: ", True, source_color)
            message_text = self.font.render(entry['message'], True, WHITE)
            
            screen.blit(source_text, (x + 15, line_y))
            screen.blit(message_text, (x + 15 + source_text.get_width() + 5, line_y))
    
    def clear(self):
        self.entries = []
    
    def export(self, exporter: LogExporter) -> List[str]:
        """Export all logs."""
        return exporter.export_all_formats()


# ==================== PROGRESS BAR ====================

class ProgressBar:
    """Enhanced progress bar."""
    
    def __init__(self, x: int, y: int, width: int, height: int):
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.progress = 0
        self.font = pygame.font.Font(None, 24)
        
    def set_progress(self, progress: int):
        self.progress = max(0, min(100, progress))
    
    def get_color(self) -> tuple:
        if self.progress < 30:
            return RED
        elif self.progress < 70:
            return YELLOW
        else:
            return GREEN
    
    def draw(self, screen):
        pygame.draw.rect(screen, GRAY, (self.x, self.y, self.width, self.height), border_radius=5)
        
        fill_width = int(self.width * self.progress / 100)
        fill_color = self.get_color()
        pygame.draw.rect(screen, fill_color, 
                        (self.x, self.y, fill_width, self.height), border_radius=5)
        
        pygame.draw.rect(screen, WHITE, (self.x, self.y, self.width, self.height), 2, border_radius=5)
        
        percent_text = self.font.render(f"{self.progress}%", True, WHITE)
        text_rect = percent_text.get_rect(center=(self.x + self.width // 2, self.y + self.height // 2))
        screen.blit(percent_text, text_rect)


# ==================== AGENT NODE ====================

class AgentNode:
    """Enhanced agent node."""
    
    def __init__(self, x: int, y: int, name: str, agent_type: str):
        self.x = x
        self.y = y
        self.name = name
        self.agent_type = agent_type
        self.radius = 40
        self.status = AgentStatus.IDLE
        self.task = Task("Idle", 0)
        self.health = 100
        self.color = AGENT_COLORS.get(agent_type, WHITE)
        self.font_large = pygame.font.Font(None, 36)
        self.font_small = pygame.font.Font(None, 24)
        self.font_tiny = pygame.font.Font(None, 18)
        
        self.selected = False
        self.pulse_size = 0
        self.progress_bar = ProgressBar(x - 30, y + 50, 100, 12)
        self.bob_offset = 0
        self.bob_direction = 1
        
    def update(self, dt: float):
        self.bob_offset += 2 * self.bob_direction
        if self.bob_offset > 5:
            self.bob_direction = -1
        elif self.bob_offset < -5:
            self.bob_direction = 1
        
        if self.selected:
            self.pulse_size = min(self.pulse_size + 1, 10)
        else:
            self.pulse_size = max(self.pulse_size - 1, 0)
    
    def draw(self, screen, boss_pos: tuple):
        bob_y = self.y + self.bob_offset
        
        # Connection line
        pygame.draw.line(screen, NEON_BLUE, boss_pos, (self.x, bob_y), 2)
        
        # Pulsing ring
        if self.pulse_size > 0:
            pygame.draw.circle(screen, 
                             (*NEON_PINK, int(255 * self.pulse_size / 10)),
                             (self.x, bob_y), self.radius + self.pulse_size, 2)
        
        # Glow effect
        glow_surface = pygame.Surface((self.radius * 2 + 20, self.radius * 2 + 20), pygame.SRCALPHA)
        glow_color = (*self.color, 50)
        pygame.draw.circle(glow_surface, glow_color, 
                         (self.radius + 10, self.radius + 10), self.radius + 10)
        screen.blit(glow_surface, (self.x - self.radius - 10, bob_y - self.radius - 10))
        
        # Main circle
        pygame.draw.circle(screen, self.color, (self.x, bob_y), self.radius)
        pygame.draw.circle(screen, WHITE, (self.x, bob_y), self.radius - 10)
        pygame.draw.circle(screen, self.color, (self.x, bob_y), self.radius - 15)
        
        # Name label
        name_text = self.font_small.render(self.name, True, WHITE)
        name_rect = name_text.get_rect(center=(self.x, bob_y + self.radius + 15))
        screen.blit(name_text, name_rect)
        
        # Status label
        status_text = self.font_tiny.render(self.status.value, True, 
                                           GREEN if self.status == AgentStatus.WORKING else GRAY)
        status_rect = status_text.get_rect(center=(self.x, bob_y + self.radius + 30))
        screen.blit(status_text, status_rect)
        
        # Progress bar
        self.progress_bar.draw(screen)
        
        # Task name if working
        if self.status == AgentStatus.WORKING:
            task_text = self.font_tiny.render(self.task.name[:15], True, CYAN)
            task_rect = task_text.get_rect(center=(self.x, bob_y + self.radius + 45))
            screen.blit(task_text, task_rect)
    
    def click(self, pos: tuple) -> bool:
        bob_y = self.y + self.bob_offset
        distance = ((self.x - pos[0]) ** 2 + (bob_y - pos[1]) ** 2) ** 0.5
        return distance < self.radius
        
    def set_task(self, task_name: str, progress: int = 0):
        self.task = Task(task_name, progress)
        self.progress_bar.set_progress(progress)
        if progress < 100:
            self.status = AgentStatus.WORKING
        else:
            self.status = AgentStatus.COMPLETE


# ==================== MAIN UPGRADED DASHBOARD ====================

class MissionControlDashboard:
    """Mission control with all upgrades integrated."""
    
    def __init__(self):
        pygame.init()
        self.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
        pygame.display.set_caption("Hermes Mission Control - UPGRADED VERSION")
        self.clock = pygame.time.Clock()
        self.running = True
        
        # Fonts
        self.font_title = pygame.font.Font(None, 48)
        self.font_header = pygame.font.Font(None, 32)
        self.font_medium = pygame.font.Font(None, 24)
        
        # Enhanced components
        self.log_feed = LogFeed(max_entries=100)
        
        # Voice alerts
        self.voice = VoiceAlertSystem() if VOICE_AVAILABLE else None
        self.voice_enabled = VOICE_AVAILABLE
        
        # Log exporter
        self.exporter = LogExporter() if EXPORT_AVAILABLE else None
        
        # Telegram notifier
        self.telegram = TelegramNotifier() if TELEGRAM_AVAILABLE else None
        
        # Agent nodes
        self.boss_node = AgentNode(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2, "Hermes Boss", "Boss")
        self.boss_node.radius = 50
        self.boss_node.color = NEON_PINK
        self.boss_node.status = AgentStatus.WORKING
        self.boss_node.task = Task("Managing Team", 85)
        self.boss_node.progress_bar.set_progress(85)
        
        self.agents: List[AgentNode] = []
        self._setup_default_agents()
        
        self.last_update = pygame.time.get_ticks()
        self.update_interval = 500
        
        # Stats
        self.agents_spawned = 4
        self.total_tasks = 0
        self.completed_tasks = 0
        
        self.activity_tick = 0
    
    def _setup_default_agents(self):
        positions = [(300, 200), (900, 200), (300, 600), (900, 600)]
        types = ['Researcher', 'Coder', 'Tester', 'Writer']
        
        for i, (pos, agent_type) in enumerate(zip(positions, types)):
            agent = AgentNode(pos[0], pos[1], f"Agent {i+1}", agent_type)
            self.agents.append(agent)
    
    def spawn_new_agent(self):
        new_types = ['Researcher', 'Coder', 'Tester', 'Writer', 'Designer', 'Analyst']
        new_type = random.choice(new_types)
        self.agents_spawned += 1
        
        row = len(self.agents) // 3
        col = len(self.agents) % 3
        
        x = 250 + col * 250
        y = 150 + row * 150
        
        agent = AgentNode(x, y, f"Agent {len(self.agents) + 1}", new_type)
        self.agents.append(agent)
        
        self.log_feed.add_entry("Hermes Boss", f"Spawned {new_type} agent", "delegation")
        
        # Voice alert
        if self.voice:
            self.voice.notify_spawn_agent(new_type)
        
        # Telegram notification
        if self.telegram:
            self.telegram.notify_spawn_agent(new_type)
    
    def _simulate_activity(self):
        self.activity_tick += 1
        
        # Randomly assign tasks
        if self.activity_tick % 60 == 0 and self.agents:
            agent = random.choice(self.agents)
            
            tasks = {
                'Researcher': ['Gathering data', 'Analyzing trends', 'Researching topic'],
                'Coder': ['Writing function', 'Debugging code', 'Building API'],
                'Tester': ['Running tests', 'Finding bugs', 'Validating input'],
                'Writer': ['Drafting report', 'Editing content', 'Creating docs'],
                'Designer': ['Designing UI', 'Creating mockups', 'Prototyping flow'],
                'Analyst': ['Processing data', 'Creating charts', 'Finding insights']
            }
            
            task_list = tasks.get(agent.agent_type, ['Working on task', 'Processing'])
            task_name = random.choice(task_list)
            
            agent.set_task(task_name, 0)
            self.log_feed.add_entry("Hermes Boss", f"Delegated: {task_name} to {agent.name}", "delegation")
            
            # Voice alert
            if self.voice:
                self.voice.notify_task_start(agent.name, task_name)
            
            # Telegram notification
            if self.telegram:
                self.telegram.notify_task_start(agent.name, task_name)
        
        # Update progress
        for agent in self.agents:
            if agent.status == AgentStatus.WORKING:
                increment = random.randint(1, 5)
                new_progress = agent.task.progress + increment
                
                if new_progress >= 100:
                    new_progress = 100
                    agent.task.completed = True
                    agent.status = AgentStatus.COMPLETE
                    self.completed_tasks += 1
                    self.log_feed.add_entry(agent.name, f"Completed: {agent.task.name}", "success")
                    agent.task = Task("Idle", 0)
                else:
                    agent.task.progress = new_progress
                
                agent.progress_bar.set_progress(new_progress)
                
                if agent.task.progress % 25 == 0 and agent.task.progress > 0:
                    self.log_feed.add_entry(agent.name, 
                                          f"Progress: {agent.task.progress}% - {agent.task.name}", 
                                          "status")
    
    def handle_events(self):
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
                
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE or event.key == pygame.K_q:
                    self.running = False
                elif event.key == pygame.K_s:
                    self.spawn_new_agent()
                elif event.key == pygame.K_r:
                    self.log_feed.clear()
                elif event.key == pygame.K_x:  # Export
                    if self.exporter:
                        files = self.log_feed.export(self.exporter)
                        self.log_feed.add_entry("Export System", f"Exported to: {len(files)} files", "upgrade")
                        for f in files:
                            self.log_feed.add_entry("Export", f"   - {f}", "success")
                elif event.key == pygame.K_e:  # Telegram test
                    if self.telegram:
                        if self.telegram.test_connection():
                            self.log_feed.add_entry("Telegram", "Test message sent!", "upgrade")
                        else:
                            self.log_feed.add_entry("Telegram", "Not configured. Check config file.", "error")
                elif event.key == pygame.K_v:  # Toggle voice
                    if self.voice:
                        self.voice_enabled = self.voice.toggle()
                        status = "ON" if self.voice_enabled else "OFF"
                        self.log_feed.add_entry("Voice System", f"Alerts {status}", "upgrade")
        
        # Handle mouse clicks
        for event in pygame.event.get():
            if event.type == pygame.MOUSEBUTTONDOWN:
                if event.button == 1:
                    pos = pygame.mouse.get_pos()
                    
                    if self.boss_node.click(pos):
                        self.boss_node.selected = True
                    else:
                        self.boss_node.selected = False
                    
                    clicked_agent = None
                    for agent in self.agents:
                        if agent.click(pos):
                            clicked_agent = agent
                            clicked_agent.selected = True
                            self.log_feed.add_entry("System", f"Selected: {agent.name}", "status")
                            break
                    
                    if clicked_agent:
                        for agent in self.agents:
                            if agent != clicked_agent:
                                agent.selected = False
    
    def draw_header(self):
        pygame.draw.rect(self.screen, (20, 30, 50), (0, 0, SCREEN_WIDTH, 70))
        pygame.draw.line(self.screen, NEON_BLUE, (0, 70), (SCREEN_WIDTH, 70), 2)
        
        title = self.font_title.render("HERMES MISSION CONTROL", True, CYAN)
        title_rect = title.get_rect(center=(SCREEN_WIDTH // 2, 25))
        self.screen.blit(title, title_rect)
        
        # Show upgrade indicators
        upgrades = []
        if VOICE_AVAILABLE:
            upgrades.append("🎤" if self.voice_enabled else "🔇")
        if EXPORT_AVAILABLE:
            upgrades.append("📁")
        if TELEGRAM_AVAILABLE:
            upgrades.append("📱")
        
        upgrade_text = " ".join(upgrades)
        upgrade_str = self.font_header.render(f"UPGRADES: {upgrade_text} | Agents: {len(self.agents)} | Tasks: {self.total_tasks} | Completed: {self.completed_tasks}", True, GREEN)
        self.screen.blit(upgrade_str, (SCREEN_WIDTH // 2 - upgrade_str.get_width() // 2, 55))
        
        hints = self.font_medium.render("S=Spawn | R=Refresh | X=Export | E=Telegram | V=Voice | Q=Quit", True, LIGHT_GRAY)
        hints_rect = hints.get_rect(center=(SCREEN_WIDTH // 2, 70))
        self.screen.blit(hints, hints_rect)
    
    def draw(self):
        self.screen.fill(DARK_BLUE)
        self.draw_header()
        
        boss_pos = (self.boss_node.x, self.boss_node.y + self.boss_node.bob_offset)
        self.boss_node.draw(self.screen, boss_pos)
        
        for agent in self.agents:
            agent.draw(self.screen, boss_pos)
            agent.update(0.016)
        
        log_x = SCREEN_WIDTH - 350
        log_y = 100
        log_width = 340
        log_height = SCREEN_HEIGHT - 120
        self.log_feed.draw(self.screen, log_x, log_y, log_width, log_height)
        
        # System info
        info_x = SCREEN_WIDTH - 340
        info_y = 85
        pygame.draw.rect(self.screen, (15, 25, 40), (info_x, info_y, 320, 15), border_radius=5)
        
        info_text = pygame.font.Font(None, 20).render("UPGRADED MISSION CONTROL", True, WHITE)
        self.screen.blit(info_text, (info_x + 10, info_y + 2))
        
        active_count = sum(1 for a in self.agents if a.status == AgentStatus.WORKING)
        active_text = pygame.font.Font(None, 20).render(f"ACTIVE: {active_count}/{len(self.agents)}", True, GREEN)
        self.screen.blit(active_text, (info_x + 10, info_y + 25))
        
        fps_text = pygame.font.Font(None, 20).render(f"FPS: {int(self.clock.get_fps())}", True, CYAN)
        self.screen.blit(fps_text, (info_x + 10, info_y + 45))
        
        pygame.display.flip()
    
    def run(self):
        self.log_feed.add_entry("System", "Dashboard initialized", "info")
        self.log_feed.add_entry("Hermes Boss", "Mission Control Online", "status")
        
        if VOICE_AVAILABLE:
            self.log_feed.add_entry("Voice System", "TTS alerts enabled", "upgrade")
        if EXPORT_AVAILABLE:
            self.log_feed.add_entry("Export System", "CSV/JSON/TXT export ready", "upgrade")
        if TELEGRAM_AVAILABLE:
            self.log_feed.add_entry("Telegram", "Notifications enabled", "upgrade")
        
        while self.running:
            dt = self.clock.tick(FPS) / 1000.0
            
            self.handle_events()
            
            now = pygame.time.get_ticks()
            if now - self.last_update > self.update_interval:
                self._simulate_activity()
                self.last_update = now
            
            self.draw()
        
        pygame.quit()
        sys.exit()


if __name__ == '__main__':
    print("=" * 70)
    print("HERMES MISSION CONTROL - UPGRADED VERSION")
    print("=" * 70)
    print()
    
    try:
        dashboard = MissionControlDashboard()
        dashboard.run()
    except KeyboardInterrupt:
        print("\nDashboard closed.")
