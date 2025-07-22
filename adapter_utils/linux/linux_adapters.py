import subprocess
import re
import json
import webview  # PyWebView for GUI
from adapter_utils.common import estimate_range_from_signal

# ================================
# Global State
# ================================
current_selected_adapter = None  # 🆕 Track selected adapter

# Precompiled regex patterns for efficiency
LSUSB_PATTERN = re.compile(r"Bus \d+ Device \d+: ID ([\da-f]{4}:[\da-f]{4}) (.+)")
LSPCI_PATTERN = re.compile(r".*Network controller \[.*\]: (.+?) \[.*\]")
DRIVER_PATTERN = re.compile(r"driver:\s*(\w+)")
SSID_PATTERN = re.compile(r"SSID: (.+)")
MAC_PATTERN = re.compile(r"Connected to ([\da-fA-F:]{17})")
SIGNAL_PATTERN = re.compile(r"signal: (-?\d+) dBm")


# ================================
# Utility Functions
# ================================
def get_usb_devices():
    """Fetch connected USB devices and descriptions"""
    usb_devices = {}
    try:
        lsusb_output = subprocess.check_output(["lsusb"]).decode("utf-8", errors="ignore")
        for line in lsusb_output.strip().splitlines():
            match = LSUSB_PATTERN.match(line)
            if match:
                usb_id, desc = match.groups()
                usb_devices[usb_id] = desc.strip()
    except subprocess.CalledProcessError:
        pass
    return usb_devices


def get_pci_devices():
    """Fetch PCI network controllers"""
    pci_devices = {}
    try:
        lspci_output = subprocess.check_output(["lspci", "-nn"]).decode("utf-8", errors="ignore")
        for line in lspci_output.strip().splitlines():
            match = LSPCI_PATTERN.match(line)
            if match:
                device_name = match.group(1).strip()
                pci_devices[device_name] = device_name
    except subprocess.CalledProcessError:
        pass
    return pci_devices


def get_driver_name(device):
    """Fetch driver name for a device"""
    try:
        output = subprocess.check_output(["ethtool", "-i", device]).decode("utf-8", errors="ignore")
        match = DRIVER_PATTERN.search(output)
        return match.group(1) if match else None
    except subprocess.CalledProcessError:
        return None


def get_wifi_device_description(device, driver_name, usb_devices, pci_devices):
    """Try to get a human-readable description of a Wi-Fi device"""
    # Check USB devices
    try:
        for usb_desc in usb_devices.values():
            if driver_name and driver_name.lower() in usb_desc.lower():
                return usb_desc
    except Exception:
        pass

    # Check PCI devices
    for pci_name in pci_devices:
        if driver_name and driver_name.lower() in pci_name.lower():
            return pci_name

    # Fallback to driver or device name
    return driver_name or device


def get_adapters_linux():
    """Returns a list of Wi-Fi adapters and their connection info on Linux"""
    adapters = []
    usb_devices = get_usb_devices()
    pci_devices = get_pci_devices()

    try:
        output = subprocess.check_output(
            ["nmcli", "-t", "-f", "DEVICE,TYPE", "device"]
        ).decode("utf-8", errors="ignore")

        for line in output.strip().splitlines():
            parts = line.strip().split(":")
            if len(parts) < 2:
                continue
            device, dev_type = parts
            if dev_type == "wifi":
                driver_name = get_driver_name(device)
                desc = get_wifi_device_description(device, driver_name, usb_devices, pci_devices)

                ssid = None
                signal = 0
                mac = None
                try:
                    iw_output = subprocess.check_output(["iw", "dev", device, "link"]).decode("utf-8", errors="ignore")
                    if "Not connected." not in iw_output:
                        if ssid_match := SSID_PATTERN.search(iw_output):
                            ssid = ssid_match.group(1).strip()
                        if mac_match := MAC_PATTERN.search(iw_output):
                            mac = mac_match.group(1).strip()
                        if signal_match := SIGNAL_PATTERN.search(iw_output):
                            dbm = int(signal_match.group(1))
                            signal = min(max(2 * (dbm + 100), 0), 100)  # Convert dBm to %
                except subprocess.CalledProcessError:
                    pass

                adapters.append({
                    "name": f"{desc} ({device})",
                    "interface": device,
                    "ssid": ssid or "Not Connected",
                    "signal": signal,
                    "mac": mac or "Unknown",
                    "range": estimate_range_from_signal(signal)
                })
    except subprocess.CalledProcessError as e:
        print(f"Failed to get wifi adapters on Linux: {e}")

    return adapters


# ================================
# API for JavaScript
# ================================
class Api:
    def getAdapters(self):
        """Returns a JSON string of available Wi-Fi adapters"""
        adapters = get_adapters_linux()
        return json.dumps(adapters)

    def adapterSelected(self, adapter_json):
        """Called by JS when user selects an adapter"""
        global current_selected_adapter
        adapter = json.loads(adapter_json)
        current_selected_adapter = adapter.get("interface")
        print(f"[INFO] Adapter selected: {current_selected_adapter}")
        return "OK"

    def scanNearbyNetworks(self, adapter_interface):
        """Perform Wi-Fi scan on the selected adapter"""
        try:
            cmd = ["nmcli", "-t", "-f", "SSID,BSSID,SIGNAL,FREQ,SECURITY", "dev", "wifi", "list", "ifname", adapter_interface]
            output = subprocess.check_output(cmd).decode("utf-8", errors="ignore")
            networks = []
            for line in output.strip().splitlines():
                parts = line.split(":")
                if len(parts) < 5:
                    continue
                ssid, bssid, signal, freq, auth = parts
                networks.append({
                    "ssid": ssid,
                    "bssid": bssid,
                    "signal": signal,
                    "freq": freq,
                    "auth": auth
                })
            return json.dumps(networks)
        except subprocess.CalledProcessError as e:
            print(f"[ERROR] Failed to scan: {e}")
            return json.dumps([])


# ================================
# Main App Launcher
# ================================
if __name__ == "__main__":
    api = Api()
    window = webview.create_window(
        "Wi-Fi Radar",
        "ui/dashboard.html",
        width=1200,
        height=800,
        resizable=True,
        confirm_quit=True,
        background_color="#000000",
        js_api=api,
        browser_args=[
            "--enable-geolocation",
            "--unsafely-treat-insecure-origin-as-secure=http://localhost",
            "--allow-insecure-localhost"
        ]
    )
    webview.start(debug=True)
