import subprocess
import re
import json
import webview  # PyWebView for GUI
from adapter_utils.common import estimate_range_from_signal

# ================================
# Global State
# ================================
current_selected_adapter = None  # Track selected adapter

# Precompiled regex patterns
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
    """Fetch connected USB devices and descriptions."""
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
    """Fetch PCI network controllers."""
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
    """Fetch driver name for a device."""
    try:
        output = subprocess.check_output(["ethtool", "-i", device]).decode("utf-8", errors="ignore")
        match = DRIVER_PATTERN.search(output)
        return match.group(1) if match else None
    except subprocess.CalledProcessError:
        return None


def get_wifi_device_description(device, driver_name, usb_devices, pci_devices):
    """Get a clean, human-readable Wi-Fi adapter name."""
    try:
        # First, try nmcli for vendor info
        nmcli_output = subprocess.check_output(
            ["nmcli", "-f", "GENERAL.VENDOR", "device", "show", device]
        ).decode("utf-8", errors="ignore")
        vendor_line = next((line for line in nmcli_output.splitlines() if "GENERAL.VENDOR" in line), None)
        if vendor_line:
            vendor = vendor_line.split(":", 1)[1].strip()
            if vendor and vendor.lower() != "unknown":
                return f"{vendor} ({device})"
    except subprocess.CalledProcessError:
        pass

    # Try USB devices match
    for usb_desc in usb_devices.values():
        if driver_name and driver_name.lower() in usb_desc.lower():
            return f"{usb_desc} ({device})"

    # Try PCI devices match
    for pci_name in pci_devices:
        if driver_name and driver_name.lower() in pci_name.lower():
            return f"{pci_name} ({device})"

    # Fallback to driver or raw device name
    return f"{driver_name or device} ({device})"

def get_adapters_linux():
    """Returns a list of Wi-Fi adapters and their connection info on Linux."""
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
                            signal = min(max(2 * (dbm + 100), 0), 100)
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
        """Return list of adapters as JSON."""
        adapters = get_adapters_linux()
        return json.dumps(adapters)

    def adapterSelected(self, adapter_json):
        """Store selected adapter from frontend."""
        global current_selected_adapter
        adapter = json.loads(adapter_json)
        current_selected_adapter = adapter.get("interface")
        print(f"[INFO] Adapter selected: {current_selected_adapter}")
        return "OK"

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
