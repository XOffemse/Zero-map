import subprocess
import json

class MonitorModeAPI:
    def __init__(self):
        # Track if monitor mode is active
        self.monitor_mode_enabled = False

    def getAdapters(self):
        """
        Return a JSON list of network adapters.
        You can expand this to detect real interfaces dynamically.
        """
        try:
            # Example static adapter list (replace with actual detection)
            adapters = [
                {"name": "wlan0", "ssid": "X-Offense-Network"},
                {"name": "wlan1", "ssid": None}
            ]
            return json.dumps(adapters)
        except Exception as e:
            print(f"[MonitorModeAPI] Error fetching adapters: {e}")
            return json.dumps([])

    def monitorModeAction(self, payload_json):
        """
        Enable or disable monitor mode on the selected adapter.
        """
        payload = json.loads(payload_json)
        adapter = payload.get("adapter", {}).get("name")
        action = payload.get("action")

        if not adapter or not action:
            raise ValueError("Invalid adapter or action provided")

        if action == "start":
            return self.enable_monitor_mode(adapter)
        elif action == "stop":
            return self.disable_monitor_mode(adapter)
        else:
            raise ValueError(f"Unknown action: {action}")

    def enable_monitor_mode(self, adapter):
        """
        Enable monitor mode on the specified adapter.
        """
        print(f"[MonitorModeAPI] Enabling monitor mode on {adapter}...")
        try:
            subprocess.run(["sudo", "ip", "link", "set", adapter, "down"], check=True)
            subprocess.run(["sudo", "iw", adapter, "set", "monitor", "control"], check=True)
            subprocess.run(["sudo", "ip", "link", "set", adapter, "up"], check=True)
            self.monitor_mode_enabled = True
            return f"Monitor mode enabled on {adapter}"
        except subprocess.CalledProcessError as e:
            print(f"[MonitorModeAPI] Failed to enable monitor mode: {e}")
            raise RuntimeError(f"Failed to enable monitor mode on {adapter}")

    def disable_monitor_mode(self, adapter):
        """
        Disable monitor mode and revert to managed mode.
        """
        print(f"[MonitorModeAPI] Disabling monitor mode on {adapter}...")
        try:
            subprocess.run(["sudo", "ip", "link", "set", adapter, "down"], check=True)
            subprocess.run(["sudo", "iw", adapter, "set", "type", "managed"], check=True)
            subprocess.run(["sudo", "ip", "link", "set", adapter, "up"], check=True)
            self.monitor_mode_enabled = False
            return f"Monitor mode disabled on {adapter}"
        except subprocess.CalledProcessError as e:
            print(f"[MonitorModeAPI] Failed to disable monitor mode: {e}")
            raise RuntimeError(f"Failed to disable monitor mode on {adapter}")
