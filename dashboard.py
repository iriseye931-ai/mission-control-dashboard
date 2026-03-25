"""
HERMES MISSION CONTROL DASHBOARD
Real-time visual interface for monitoring sub-agent team

Controls:
- S : Spawn new sub-agent
- Q : Quit
- R : Refresh dashboard
- Mouse : Click agents to see details

Author: Hermes the Boss
"""

import pygame
import sys
import random
import time
import os
from datetime import datetime
from typing import List, Dict, Optional
from dataclasses import dataclass
from enum import Enum
import threading
import queue

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


# ==================== LOG SYSTEM ====================

class LogFeed:
    """Scrolling log feed for real-time events."""
    
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
        
        # Limit entries
        if len(self.entries) > self.max_entries:
            self.entries.pop(0)
    
    def _get_color(self, log_type: str) -> tuple:
        """Get color based on log type."""
        colors = {
            'info': CYAN,
            'success': GREEN,
            'warning': YELLOW,
            'error': RED,
            'delegation': MAGENTA,
            'status': BLUE
        }
        return colors.get(log_type, WHITE)
    
    def draw(self, screen, x: int, y: int, width: int, height: int):
        """Draw the log feed panel."""
        # Panel background
        pygame.draw.rect(screen, (20, 30, 50), (x, y, width, height), border_radius=8)
        pygame.draw.rect(screen, NEON_BLUE, (x, y, width, height), 2, border_radius=8)
        
        # Header
        header = self.bold_font.render("MISSION LOGS", True, CYAN)
        screen.blit(header, (x + 15, y + 10))
        
        # Draw entries
        for i, entry in enumerate(self.entries[-25:]):  # Show last 25
            line_y = y + 50 + i * 25
            if line_y + 25 > y + height:
                break
            
            # Source with color
            source_color = entry['color']
            source_text = self.font.render(f"[{entry['timestamp']}] {entry['source']}: ", True, source_color)
            message_text = self.font.render(entry['message'], True, WHITE)
            
            screen.blit(source_text, (x + 15, line_y))
            screen.blit(message_text, (x + 15 + source_text.get_width() + 5, line_y))
        
        # Scroll indicator
        if len(self.entries) > 25:
            indicator = self.font.render("▼ More", True, LIGHT_GRAY)
            screen.blit(indicator, (x + width - 60, y + height - 25))
    
    def clear(self):
        """Clear all logs."""
        self.entries = []


# ==================== PROGRESS BAR ====================

class ProgressBar:
    """Visual progress bar with color coding."""
    
    def __init__(self, x: int, y: int, width: int, height: int):
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.progress = 0
        self.font = pygame.font.Font(None, 24)
        
    def set_progress(self, progress: int):
        """Set progress (0-100)."""
        self.progress = max(0, min(100, progress))
    
    def get_color(self) -> tuple:
        """Get color based on progress."""
        if self.progress < 30:
            return RED
        elif self.progress < 70:
            return YELLOW
        else:
            return GREEN
    
    def draw(self, screen):
        """Draw the progress bar."""
        # Background
        pygame.draw.rect(screen, GRAY, (self.x, self.y, self.width, self.height), border_radius=5)
        
        # Fill
        fill_width = int(self.width * self.progress / 100)
        fill_color = self.get_color()
        pygame.draw.rect(screen, fill_color, 
                        (self.x, self.y, fill_width, self.height), border_radius=5)
        
        # Border
        pygame.draw.rect(screen, WHITE, (self.x, self.y, self.width, self.height), 2, border_radius=5)
        
        # Percentage text
        percent_text = self.font.render(f"{self.progress}%", True, WHITE)
        text_rect = percent_text.get_rect(center=(self.x + self.width // 2, self.y + self.height // 2))
        screen.blit(percent_text, text_rect)


# ==================== AGENT NODE ====================

class AgentNode:
    """Visual node representing a sub-agent."""
    
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
        
        # Selection state
        self.selected = False
        self.pulse_timer = 0
        self.pulse_size = 0
        
        # Progress bar
        self.progress_bar = ProgressBar(x - 30, y + 50, 100, 12)
        
        # Animation
        self.bob_offset = 0
        self.bob_direction = 1
        
    def update(self, dt: float):
        """Update agent state."""
        # Bobbing animation
        self.bob_offset += 2 * self.bob_direction
        if self.bob_offset > 5:
            self.bob_direction = -1
        elif self.bob_offset < -5:
            self.bob_direction = 1
        
        # Pulsing when selected
        if self.selected:
            self.pulse_size = min(self.pulse_size + 1, 10)
        else:
            self.pulse_size = max(self.pulse_size - 1, 0)
    
    def draw(self, screen, boss_pos: tuple):
        """Draw the agent node and connection line."""
        bob_y = self.y + self.bob_offset
        
        # Draw connection line to boss
        pygame.draw.line(screen, NEON_BLUE, boss_pos, (self.x, bob_y), 2)
        
        # Draw pulsing ring if selected
        if self.pulse_size > 0:
            pygame.draw.circle(screen, 
                             (*NEON_PINK, int(255 * self.pulse_size / 10)),
                             (self.x, bob_y), self.radius + self.pulse_size, 2)
        
        # Agent circle with glow
        glow_surface = pygame.Surface((self.radius * 2 + 20, self.radius * 2 + 20), pygame.SRCALPHA)
        glow_color = (*self.color, 50)
        pygame.draw.circle(glow_surface, glow_color, 
                         (self.radius + 10, self.radius + 10), self.radius + 10)
        screen.blit(glow_surface, (self.x - self.radius - 10, bob_y - self.radius - 10))
        
        # Main circle
        pygame.draw.circle(screen, self.color, (self.x, bob_y), self.radius)
        
        # Inner detail
        pygame.draw.circle(screen, WHITE, (self.x, bob_y), self.radius - 10)
        pygame.draw.circle(screen, self.color, (self.x, bob_y), self.radius - 15)
        
        # Agent type icon (simple shape)
        icon_y = bob_y - 5
        if self.agent_type == 'Researcher':
            pygame.draw.circle(screen, WHITE, (self.x, icon_y), 8)
        elif self.agent_type == 'Coder':
            pygame.draw.polygon(screen, WHITE, [
                (self.x - 10, icon_y - 8),
                (self.x + 10, icon_y - 8),
                (self.x, icon_y + 8)
            ])
        elif self.agent_type == 'Tester':
            pygame.draw.rect(screen, WHITE, (self.x - 10, icon_y - 6, 20, 12))
        elif self.agent_type == 'Writer':
            pygame.draw.ellipse(screen, WHITE, (self.x - 10, icon_y - 8, 20, 16))
        
        # Name label
        name_text = self.font_small.render(self.name, True, WHITE)
        name_rect = name_text.get_rect(center=(self.x, bob_y + self.radius + 15))
        screen.blit(name_text, name_rect)
        
        # Status label
        status_text = self.font_tiny.render(self.status.value, True, 
                                           GREEN if self.status == AgentStatus.WORKING else GRAY)
        status_rect = status_text.get_rect(center=(self.x, bob_y + self.radius + 30))
        screen.blit(status_text, status_rect)
        
        # Draw progress bar
        self.progress_bar.draw(screen)
        
        # Draw task name if working
        if self.status == AgentStatus.WORKING:
            task_text = self.font_tiny.render(self.task.name[:15], True, CYAN)
            task_rect = task_text.get_rect(center=(self.x, bob_y + self.radius + 45))
            screen.blit(task_text, task_rect)
    
    def click(self, pos: tuple) -> bool:
        """Check if clicked. Returns True if clicked."""
        bob_y = self.y + self.bob_offset
        distance = ((self.x - pos[0]) ** 2 + (bob_y - pos[1]) ** 2) ** 0.5
        return distance < self.radius
        
    def set_task(self, task_name: str, progress: int = 0):
        """Set current task."""
        self.task = Task(task_name, progress)
        self.progress_bar.set_progress(progress)
        if progress < 100:
            self.status = AgentStatus.WORKING
        else:
            self.status = AgentStatus.COMPLETE


# ==================== MAIN DASHBOARD ====================

class MissionControlDashboard:
    """Main mission control dashboard."""
    
    def __init__(self):
        pygame.init()
        self.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
        pygame.display.set_caption("Hermes Mission Control")
        self.clock = pygame.time.Clock()
        self.running = True
        
        # Fonts
        self.font_title = pygame.font.Font(None, 48)
        self.font_header = pygame.font.Font(None, 32)
        self.font_medium = pygame.font.Font(None, 24)
        
        # Log feed
        self.log_feed = LogFeed(max_entries=100)
        
        # Agent nodes
        self.boss_node = self._create_boss_node()
        self.agents: List[AgentNode] = []
        
        # Initialize with 4 default agents
        self._setup_default_agents()
        
        # Timer for updates
        self.last_update = pygame.time.get_ticks()
        self.update_interval = 500  # milliseconds
        
        # Stats
        self.agents_spawned = 4
        self.total_tasks = 0
        self.completed_tasks = 0
        
        # Simulated activity
        self.activity_tick = 0
        
    def _create_boss_node(self) -> AgentNode:
        """Create the central boss node."""
        boss = AgentNode(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2, "Hermes Boss", "Boss")
        boss.radius = 50
        boss.color = NEON_PINK
        boss.status = AgentStatus.WORKING
        boss.task = Task("Managing Team", 85)
        boss.progress_bar.set_progress(85)
        return boss
    
    def _setup_default_agents(self):
        """Set up default agent positions around boss."""
        positions = [
            (300, 200),   # Top-left
            (900, 200),   # Top-right
            (300, 600),   # Bottom-left
            (900, 600),   # Bottom-right
        ]
        
        types = ['Researcher', 'Coder', 'Tester', 'Writer']
        
        for i, (pos, agent_type) in enumerate(zip(positions, types)):
            agent = AgentNode(pos[0], pos[1], f"Agent {i+1}", agent_type)
            self.agents.append(agent)
    
    def spawn_new_agent(self):
        """Spawn a new random agent."""
        new_types = ['Researcher', 'Coder', 'Tester', 'Writer', 'Designer', 'Analyst']
        new_type = random.choice(new_types)
        self.agents_spawned += 1
        
        # Position in a grid pattern
        row = len(self.agents) // 3
        col = len(self.agents) % 3
        
        x = 250 + col * 250
        y = 150 + row * 150
        
        agent = AgentNode(x, y, f"Agent {len(self.agents) + 1}", new_type)
        self.agents.append(agent)
        
        self.log_feed.add_entry("Hermes Boss", f"Spawned {new_type} agent", "delegation")
        
    def _simulate_activity(self):
        """Simulate sub-agent activity for demo purposes."""
        self.activity_tick += 1
        
        # Randomly assign tasks to agents
        if self.activity_tick % 60 == 0 and self.agents:
            agent = random.choice(self.agents)
            
            # Determine task
            tasks = {
                'Researcher': ['Gathering data', 'Analyzing trends', 'Researching topic', 'Collecting sources'],
                'Coder': ['Writing function', 'Debugging code', 'Refactoring module', 'Building API'],
                'Tester': ['Running tests', 'Finding bugs', 'Validating input', 'Checking edge cases'],
                'Writer': ['Drafting report', 'Editing content', 'Creating docs', 'Reviewing specs'],
                'Designer': ['Designing UI', 'Creating mockups', 'Polishing assets', 'Prototyping flow'],
                'Analyst': ['Processing data', 'Creating charts', 'Finding insights', 'Summarizing results']
            }
            
            task_list = tasks.get(agent.agent_type, ['Working on task', 'Processing'])
            task_name = random.choice(task_list)
            
            # Start task
            agent.set_task(task_name, 0)
            self.log_feed.add_entry("Hermes Boss", f"Delegated: {task_name} to {agent.name}", "delegation")
        
        # Update progress for working agents
        for agent in self.agents:
            if agent.status == AgentStatus.WORKING:
                # Random progress increment
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
                
                # Log progress updates occasionally
                if agent.task.progress % 25 == 0 and agent.task.progress > 0:
                    self.log_feed.add_entry(agent.name, 
                                          f"Progress: {agent.task.progress}% - {agent.task.name}", 
                                          "status")
        
        self.activity_tick += 1
    
    def handle_events(self):
        """Handle pygame events."""
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
                    self.log_feed.add_entry("Hermes Boss", "Dashboard refreshed", "info")
            
            elif event.type == pygame.MOUSEBUTTONDOWN:
                if event.button == 1:  # Left click
                    pos = pygame.mouse.get_pos()
                    
                    # Check boss click
                    if self.boss_node.click(pos):
                        self.boss_node.selected = True
                        self.log_feed.add_entry("System", f"Boss node selected - Status: {self.boss_node.status.value}", "status")
                    
                    # Check agent clicks
                    clicked_agent = None
                    for agent in self.agents:
                        if agent.click(pos):
                            clicked_agent = agent
                            clicked_agent.selected = True
                            self.log_feed.add_entry("System", f"Selected: {agent.name} ({agent.agent_type}) - {agent.status.value}", "status")
                            break
                    
                    # Deselect others
                    if clicked_agent:
                        for agent in self.agents:
                            if agent != clicked_agent:
                                agent.selected = False
                        self.boss_node.selected = False
    
    def draw_ui_header(self):
        """Draw the top UI header."""
        # Background strip
        pygame.draw.rect(self.screen, (20, 30, 50), (0, 0, SCREEN_WIDTH, 70))
        pygame.draw.line(self.screen, NEON_BLUE, (0, 70), (SCREEN_WIDTH, 70), 2)
        
        # Title
        title = self.font_title.render("HERMES MISSION CONTROL", True, CYAN)
        title_rect = title.get_rect(center=(SCREEN_WIDTH // 2, 25))
        self.screen.blit(title, title_rect)
        
        # Stats bar
        stats = self.font_medium.render(
            f"Agents: {len(self.agents)} | Tasks: {self.total_tasks} | Completed: {self.completed_tasks} | Status: ACTIVE",
            True, GREEN
        )
        stats_rect = stats.get_rect(center=(SCREEN_WIDTH // 2, 55))
        self.screen.blit(stats, stats_rect)
        
        # Control hints
        hints = self.font_medium.render("S=Spawn | R=Refresh | Q=Quit", True, LIGHT_GRAY)
        hints_rect = hints.get_rect(center=(SCREEN_WIDTH // 2, 70))
        self.screen.blit(hints, hints_rect)
        
        # Time display
        time_text = self.font_medium.render(f"Time: {datetime.now().strftime('%H:%M:%S')}", True, WHITE)
        time_rect = time_text.get_rect(center=(SCREEN_WIDTH - 100, 35))
        self.screen.blit(time_text, time_rect)
    
    def draw(self):
        """Draw the complete dashboard."""
        # Background
        self.screen.fill(DARK_BLUE)
        
        # Draw mission header
        self.draw_ui_header()
        
        # Draw boss node
        boss_pos = (self.boss_node.x, self.boss_node.y + self.boss_node.bob_offset)
        self.boss_node.draw(self.screen, boss_pos)
        
        # Draw all agents
        for agent in self.agents:
            agent.draw(self.screen, boss_pos)
            agent.update(0.016)  # ~60 FPS
        
        # Draw log feed panel
        log_x = SCREEN_WIDTH - 350
        log_y = 100
        log_width = 340
        log_height = SCREEN_HEIGHT - 120
        self.log_feed.draw(self.screen, log_x, log_y, log_width, log_height)
        
        # Draw system info panel
        info_x = SCREEN_WIDTH - 340
        info_y = 85
        pygame.draw.rect(self.screen, (15, 25, 40), (info_x, info_y, 320, 15), border_radius=5)
        
        info_text = self.font_small = pygame.font.Font(None, 20)
        info = info_text.render("MISSION CONTROL SYSTEM", True, WHITE)
        self.screen.blit(info, (info_x + 10, info_y + 2))
        
        # Active agents indicator
        active_count = sum(1 for a in self.agents if a.status == AgentStatus.WORKING)
        active_text = info_text.render(f"ACTIVE: {active_count}/{len(self.agents)}", True, GREEN)
        self.screen.blit(active_text, (info_x + 10, info_y + 25))
        
        # FPS display
        fps = info_text.render(f"FPS: {int(self.clock.get_fps())}", True, CYAN)
        self.screen.blit(fps, (info_x + 10, info_y + 45))
        
        pygame.display.flip()
    
    def run(self):
        """Main game loop."""
        self.log_feed.add_entry("System", "Dashboard initialized", "info")
        self.log_feed.add_entry("Hermes Boss", "Mission Control Online", "status")
        
        while self.running:
            dt = self.clock.tick(FPS) / 1000.0
            
            self.handle_events()
            
            # Simulate activity every 500ms
            now = pygame.time.get_ticks()
            if now - self.last_update > self.update_interval:
                self._simulate_activity()
                self.last_update = now
            
            self.draw()
        
        pygame.quit()
        sys.exit()


# ==================== FALLBACK CONSOLE VERSION ====================

def run_console_version():
    """Fallback console-based mission control."""
    print("=" * 70)
    print("HERMES MISSION CONTROL - CONSOLE VERSION")
    print("=" * 70)
    print()
    print("Controls:")
    print("  S : Spawn new agent")
    print("  R : Refresh logs")
    print("  Q : Quit")
    print()
    print("Initializing dashboard...")
    print("=" * 70)
    print()
    
    # Simulated log
    logs = []
    agents = [
        {'name': 'Agent 1', 'type': 'Researcher', 'status': 'IDLE', 'progress': 0},
        {'name': 'Agent 2', 'type': 'Coder', 'status': 'IDLE', 'progress': 0},
        {'name': 'Agent 3', 'type': 'Tester', 'status': 'IDLE', 'progress': 0},
        {'name': 'Agent 4', 'type': 'Writer', 'status': 'IDLE', 'progress': 0},
    ]
    
    import keyboard
    
    try:
        while True:
            # Clear screen
            os.system('clear' if os.name == 'posix' else 'cls')
            
            # Draw header
            print("=" * 70)
            print("HERMES MISSION CONTROL - CONSOLE VERSION")
            print(f"Time: {datetime.now().strftime('%H:%M:%S')} | Status: ACTIVE")
            print("=" * 70)
            print()
            
            # Draw agents
            for agent in agents:
                status_color = "🟢" if agent['status'] == 'WORKING' else "⚪" if agent['status'] == 'IDLE' else "🔴"
                print(f"{status_color} {agent['name']} ({agent['type']}) - {agent['status']} | Progress: {agent['progress']}%")
            
            print()
            print("LOG FEED:")
            print("-" * 70)
            for log in logs[-10:]:
                print(f"[{log['time']}] {log['source']}: {log['message']}")
            
            print()
            print("-" * 70)
            print("Press S to spawn | R to refresh | Q to quit")
            
            # Check for key
            if keyboard.is_pressed('s'):
                new_type = random.choice(['Researcher', 'Coder', 'Tester', 'Writer'])
                agents.append({'name': f"Agent {len(agents)+1}", 'type': new_type, 'status': 'IDLE', 'progress': 0})
                logs.append({'time': datetime.now().strftime('%H:%M'), 'source': 'Hermes Boss', 
                           'message': f"Spawned {new_type} agent", 'type': 'delegation'})
            
            if keyboard.is_pressed('q'):
                break
            
            if keyboard.is_pressed('r'):
                logs.clear()
            
            time.sleep(0.5)
            
    except KeyboardInterrupt:
        print("\nDashboard closed.")


# ==================== MAIN ENTRY ====================

if __name__ == '__main__':
    print("=" * 70)
    print("HERMES MISSION CONTROL - Starting...")
    print("=" * 70)
    print()
    
    try:
        # Try to initialize pygame display
        try:
            dashboard = MissionControlDashboard()
            dashboard.run()
        except Exception as e:
            print(f"❌ Display error: {e}")
            print("📝 Running in console mode...")
            print()
            run_console_version()
            
    except KeyboardInterrupt:
        print("\nDashboard closed by user.")
    
    print("\n" + "=" * 70)
    print("Mission Control Session Complete")
    print("=" * 70)
