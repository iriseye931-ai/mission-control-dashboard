"""
LOG EXPORT SYSTEM
Export and save mission logs to various formats

Author: Hermes the Boss
"""

import csv
import json
import os
from datetime import datetime
from typing import List, Dict, Optional
from pathlib import Path

class LogExporter:
    """Export mission logs to various formats."""
    
    def __init__(self, logs_dir: str = "logs"):
        self.logs_dir = logs_dir
        Path(logs_dir).mkdir(parents=True, exist_ok=True)
        self.export_history: List[Dict] = []
    
    def export_to_csv(self, filename: Optional[str] = None) -> str:
        """Export logs to CSV file."""
        if filename is None:
            filename = f"logs_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        
        filepath = os.path.join(self.logs_dir, filename)
        
        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['Timestamp', 'Source', 'Message', 'Type'])
            # This would need access to log entries
            # Simulating for now
            writer.writerow(['2024-01-01 12:00:00', 'System', 'Test entry', 'info'])
        
        self.export_history.append({'file': filename, 'type': 'CSV', 'time': datetime.now().isoformat()})
        return filepath
    
    def export_to_json(self, filename: Optional[str] = None) -> str:
        """Export logs to JSON file."""
        if filename is None:
            filename = f"logs_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        filepath = os.path.join(self.logs_dir, filename)
        
        # Simulated log data
        logs_data = [
            {
                'timestamp': '2024-01-01 12:00:00',
                'source': 'Hermes Boss',
                'message': 'Mission Control Online',
                'type': 'status'
            },
            {
                'timestamp': '2024-01-01 12:01:00',
                'source': 'Agent 1',
                'message': 'Task started: Research topic',
                'type': 'info'
            }
        ]
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(logs_data, f, indent=2)
        
        self.export_history.append({'file': filename, 'type': 'JSON', 'time': datetime.now().isoformat()})
        return filepath
    
    def export_to_text(self, filename: Optional[str] = None) -> str:
        """Export logs to plain text file."""
        if filename is None:
            filename = f"logs_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        
        filepath = os.path.join(self.logs_dir, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write("=" * 70 + "\n")
            f.write("HERMES MISSION CONTROL - LOG EXPORT\n")
            f.write("=" * 70 + "\n")
            f.write(f"Exported: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write("=" * 70 + "\n\n")
            
            f.write("[SIMULATED LOG ENTRIES]\n\n")
            f.write(f"[12:00:00] System: Dashboard initialized\n")
            f.write(f"[12:00:01] Hermes Boss: Mission Control Online\n")
            f.write(f"[12:00:02] Hermes Boss: Delegated: Research task to Agent 1\n")
            f.write(f"[12:00:05] Agent 1: Progress: 25% - Researching topic\n")
            f.write(f"[12:00:10] Agent 1: Progress: 50% - Researching topic\n")
            f.write(f"[12:00:15] Agent 1: Completed: Research task\n")
        
        self.export_history.append({'file': filename, 'type': 'TXT', 'time': datetime.now().isoformat()})
        return filepath
    
    def export_all_formats(self) -> List[str]:
        """Export logs to all available formats."""
        files = []
        files.append(self.export_to_csv())
        files.append(self.export_to_json())
        files.append(self.export_to_text())
        return files
    
    def get_export_history(self) -> List[Dict]:
        """Get list of all exports."""
        return self.export_history
    
    def delete_old_exports(self, days: int = 7):
        """Delete exports older than specified days."""
        cutoff = datetime.now().timestamp() - (days * 24 * 60 * 60)
        
        for f in os.listdir(self.logs_dir):
            filepath = os.path.join(self.logs_dir, f)
            if os.path.isfile(filepath):
                mtime = os.path.getmtime(filepath)
                if mtime < cutoff:
                    os.remove(filepath)
                    print(f"🗑️ Deleted old export: {f}")


# Usage example
if __name__ == '__main__':
    exporter = LogExporter()
    
    print("📊 Exporting logs...")
    csv_file = exporter.export_to_csv()
    json_file = exporter.export_to_json()
    txt_file = exporter.export_to_text()
    
    print(f"✅ CSV exported to: {csv_file}")
    print(f"✅ JSON exported to: {json_file}")
    print(f"✅ TXT exported to: {txt_file}")
    
    print("\n📁 Export history:")
    for exp in exporter.get_export_history():
        print(f"   - {exp['type']}: {exp['file']}")
