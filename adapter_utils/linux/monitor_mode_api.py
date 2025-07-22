import subprocess
import json
import signal
import os
import atexit
from adapter_utils.linux.linux_adapters import get_adapters_linux  # Import the updated adapter fetcher

class MonitorModeAPI:
    def __init__(self):
        self.monitor_mode_enabled = False
        self.sudo_password = None  # Cache password to avoid asking repeatedly
        self.killed_processes = False  # Track if we killed processes
        atexit.register(self.cleanup_on_exit)  # Ensure cleanup on exit

    def getAdapters(self):
        """
        Fetch available Wi-Fi adapters from the updated Linux adapter utility.
        """
        try:
            adapters = get_adapters_linux()
            return json.dumps(adapters)
        except Exception as e:
            print(f"[MonitorModeAPI] Error fetching adapters: {e}")
            return json.dumps([])

    def monitorModeAction(self, payload_json):
        """
        Enable or disable monitor mode based on frontend payload.
        """
        payload = json.loads(payload_json)
        adapter = payload.get("adapter", {}).get("name")
        action = payload.get("action")
        password = payload.get("password", None)  # Get password from frontend

        if not adapter or not action:
            raise ValueError("Invalid adapter or action provided")

        adapter = self._sanitize_adapter_name(adapter)
        print(f"[MonitorModeAPI] Using sanitized adapter name: {adapter}")

        if action == "start":
            return self.enable_monitor_mode(adapter, password)
        elif action == "stop":
            return self.disable_monitor_mode(adapter, password)
        else:
            raise ValueError(f"Unknown action: {action}")

    def enable_monitor_mode(self, adapter, password=None):
        """
        Enable monitor mode on the specified adapter.
        """
        print(f"[MonitorModeAPI] Enabling monitor mode on {adapter}...")
        try:
            # Kill interfering processes
            print("[MonitorModeAPI] Killing interfering processes with airmon-ng check kill...")
            self._run_sudo_command(["airmon-ng", "check", "kill"], password)
            self.killed_processes = True

            # Bring interface down, set monitor, bring back up
            self._run_sudo_command(["ip", "link", "set", adapter, "down"], password)
            self._run_sudo_command(["iw", adapter, "set", "monitor", "control"], password)
            self._run_sudo_command(["ip", "link", "set", adapter, "up"], password)

            self.monitor_mode_enabled = True
            return f"Monitor mode enabled on {adapter}"
        except subprocess.CalledProcessError as e:
            print(f"[MonitorModeAPI] Failed to enable monitor mode: {e}")
            raise RuntimeError(f"Failed to enable monitor mode on {adapter}: {e}")

    def disable_monitor_mode(self, adapter, password=None):
        """
        Disable monitor mode on the specified adapter.
        """
        print(f"[MonitorModeAPI] Disabling monitor mode on {adapter}...")
        try:
            self._run_sudo_command(["ip", "link", "set", adapter, "down"], password)
            self._run_sudo_command(["iw", adapter, "set", "type", "managed"], password)
            self._run_sudo_command(["ip", "link", "set", adapter, "up"], password)

            # Restart network processes if we killed them earlier
            if self.killed_processes:
                print("[MonitorModeAPI] Restarting networking processes with service NetworkManager restart...")
                self._run_sudo_command(["service", "NetworkManager", "restart"], password)
                self.killed_processes = False

            self.monitor_mode_enabled = False
            return f"Monitor mode disabled on {adapter}"
        except subprocess.CalledProcessError as e:
            print(f"[MonitorModeAPI] Failed to disable monitor mode: {e}")
            raise RuntimeError(f"Failed to disable monitor mode on {adapter}: {e}")

    def _run_sudo_command(self, cmd, password=None):
        """
        Run a command with sudo, supplying the password if needed.
        """
        print(f"[MonitorModeAPI] Running command: {' '.join(cmd)}")
        if password:
            print("[MonitorModeAPI] Using provided password for sudo...")
            try:
                subprocess.run(
                    ['sudo', '-S'] + cmd,
                    input=f"{password}\n",
                    encoding='utf-8',
                    check=True
                )
            except subprocess.CalledProcessError:
                print("[MonitorModeAPI] Sudo command failed (bad password or invalid interface?)")
                raise RuntimeError("Incorrect password or sudo command failed.")
        else:
            try:
                subprocess.run(['sudo'] + cmd, check=True)
            except subprocess.CalledProcessError:
                print("[MonitorModeAPI] Sudo command failed (no password provided)")
                raise RuntimeError("Sudo command failed. Root access may be required.")

    def _sanitize_adapter_name(self, adapter):
        """
        Extract actual interface name from user-friendly string like 'TP-Link (wlan0)'.
        """
        if "(" in adapter and ")" in adapter:
            adapter = adapter.split("(")[-1].replace(")", "").strip()
        return adapter.strip()

    def cleanup_on_exit(self):
        """
        Restore system state if app is force-quit.
        """
        if self.monitor_mode_enabled:
            print("[MonitorModeAPI] Cleaning up: disabling monitor mode...")
            try:
                self.disable_monitor_mode("wlan0", self.sudo_password)
            except Exception as e:
                print(f"[MonitorModeAPI] Error disabling monitor mode during cleanup: {e}")

        if self.killed_processes:
            print("[MonitorModeAPI] Cleaning up: restarting NetworkManager...")
            try:
                self._run_sudo_command(["service", "NetworkManager", "restart"], self.sudo_password)
            except Exception as e:
                print(f"[MonitorModeAPI] Error restarting NetworkManager: {e}")
