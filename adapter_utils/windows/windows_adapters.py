import subprocess
import re
from adapter_utils.common import estimate_range_from_signal


def get_adapters_windows():
    """Returns all Wi-Fi adapters (connected + disconnected) with human-readable names on Windows."""
    adapters = []

    # 1. Get all interface descriptions from: netsh wlan show drivers
    try:
        drivers_output = subprocess.check_output("netsh wlan show drivers", shell=True, stderr=subprocess.STDOUT).decode(errors='ignore')
        # Extract pairs of Interface name and Description
        interfaces = re.findall(r"^\s*Interface name\s*:\s*(.+?)\r?\n(?:.*\r?\n)*?\s*Driver\s*:\s*(.+)", drivers_output, re.MULTILINE)
    except subprocess.CalledProcessError as e:
        print(f"Failed to get wlan drivers: {e.output.decode(errors='ignore')}")
        return adapters

    # 2. Get info about currently connected adapters
    try:
        connected_output = subprocess.check_output("netsh wlan show interfaces", shell=True, stderr=subprocess.STDOUT).decode(errors='ignore')
        connected_blocks = connected_output.strip().split("\n\n")
    except subprocess.CalledProcessError as e:
        print(f"Failed to get wlan interfaces: {e.output.decode(errors='ignore')}")
        connected_blocks = []

    # 3. Build a map of connected interface descriptions
    connected_info_map = {}
    for block in connected_blocks:
        desc_match = re.search(r"^\s*Description\s*:\s*(.*)$", block, re.MULTILINE)
        ssid_match = re.search(r"^\s*SSID\s*:\s*(.*)$", block, re.MULTILINE)
        signal_match = re.search(r"^\s*Signal\s*:\s*(\d+)%", block, re.MULTILINE)
        mac_match = re.search(r"^\s*BSSID\s*:\s*(.*)$", block, re.MULTILINE)

        if desc_match:
            desc = desc_match.group(1).strip()
            connected_info_map[desc] = {
                "ssid": ssid_match.group(1).strip() if ssid_match else "Not Connected",
                "signal": int(signal_match.group(1)) if signal_match else 0,
                "mac": mac_match.group(1).strip() if mac_match else "Unknown"
            }

    # 4. Merge all known interfaces (connected or not) with readable name and signal info
    for interface_name, driver_desc in interfaces:
        interface_name = interface_name.strip()
        driver_desc = driver_desc.strip()
        conn = connected_info_map.get(driver_desc)

        ssid = conn["ssid"] if conn else "Not Connected"
        signal = conn["signal"] if conn else 0
        mac = conn["mac"] if conn else "Unknown"

        adapters.append({
            "name": f"{driver_desc} ({interface_name})",
            "interface": interface_name,
            "ssid": ssid,
            "signal": signal,
            "mac": mac,
            "range": estimate_range_from_signal(signal)
        })

    return adapters
