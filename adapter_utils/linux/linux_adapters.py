import subprocess
import re
import json
import webview  # <-- Add PyWebView for GUI
from adapter_utils.common import estimate_range_from_signal


def get_usb_devices():
    """
    Returns a dict mapping USB vendor/product IDs to human-readable names.
    """
    usb_devices = {}
    try:
        lsusb_output = subprocess.check_output(
            "lsusb", shell=True).decode(errors="ignore")
        for line in lsusb_output.strip().splitlines():
            match = re.match(r"Bus \d+ Device \d+: ID ([\da-f]{4}:[\da-f]{4}) (.+)", line)
            if match:
                usb_id, desc = match.groups()
                usb_devices[usb_id] = desc.strip()
    except subprocess.CalledProcessError:
        pass
    return usb_devices


def get_pci_devices():
    """
    Returns a dict mapping PCI device IDs to human-readable names.
    """
    pci_devices = {}
    try:
        lspci_output = subprocess.check_output(
            "lspci -nn", shell=True).decode(errors="ignore")
        for line in lspci_output.strip().splitlines():
            if "Network controller" in line or "Wireless" in line:
                match = re.match(r".*Network controller \[(.*)\]: (.+?) \[(.*)\]", line)
                if match:
                    device_name = match.group(2).strip()
                    pci_devices[device_name] = device_name
    except subprocess.CalledProcessError:
        pass
    return pci_devices


def get_driver_name(device):
    """
    Gets the driver name for a network interface.
    """
    try:
        output = subprocess.check_output(
            f"ethtool -i {device} | grep driver",
            shell=True).decode(errors="ignore")
        match = re.search(r"driver:\s*(\w+)", output)
        if match:
            return match.group(1)
    except subprocess.CalledProcessError:
        pass
    return None


def get_wifi_device_description(device, driver_name, usb_devices, pci_devices):
    """
    Get a human-readable description for a Wi-Fi device
    by checking USB and PCI devices.
    """
    # Check USB
    try:
        lsusb_output = subprocess.check_output(
            "lsusb", shell=True).decode(errors="ignore")
        for line in lsusb_output.strip().splitlines():
            if driver_name and driver_name.lower() in line.lower():
                match = re.match(r"Bus \d+ Device \d+: ID ([\da-f]{4}:[\da-f]{4}) (.+)", line)
                if match:
                    _, desc = match.groups()
                    return desc.strip()
    except subprocess.CalledProcessError:
        pass

    # Check PCI
    for pci_name in pci_devices:
        if driver_name and driver_name.lower() in pci_name.lower():
            return pci_name

    # Fallback
    return driver_name or device


def get_adapters_linux():
    """
    Returns a list of Wi-Fi adapters and their connection info on Linux.
    """
    adapters = []
    usb_devices = get_usb_devices()
    pci_devices = get_pci_devices()

    try:
        output = subprocess.check_output(
            "nmcli -t -f DEVICE,TYPE device",
            shell=True).decode(errors="ignore")

        for line in output.strip().splitlines():
            parts = line.strip().split(":")
            if len(parts) < 2:
                continue
            device, dev_type = parts
            if dev_type == "wifi":
                # Get driver name
                driver_name = get_driver_name(device)
                # Get adapter description
                desc = get_wifi_device_description(device, driver_name, usb_devices, pci_devices)

                # Check if connected
                ssid = None
                signal = 0
                mac = None
                try:
                    iw_output = subprocess.check_output(
                        f"iw dev {device} link", shell=True).decode(errors="ignore")
                    if "Not connected." not in iw_output:
                        ssid_match = re.search(r"SSID: (.+)", iw_output)
                        mac_match = re.search(r"Connected to ([\da-fA-F:]{17})", iw_output)
                        signal_match = re.search(r"signal: (-?\d+) dBm", iw_output)

                        if ssid_match:
                            ssid = ssid_match.group(1).strip()
                        if mac_match:
                            mac = mac_match.group(1).strip()
                        if signal_match:
                            dbm = int(signal_match.group(1))
                            signal = min(max(2 * (dbm + 100), 0), 100)  # Approximate % from dBm
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
        print(f"Failed to get wifi adapters on Linux: {e.output.decode(errors='ignore')}")

    return adapters


if __name__ == "__main__":
    # Launch the WebView app with Chromium flags
    window = webview.create_window(
        "Wi-Fi Radar",
        "ui/dashboard.html",  # path to your frontend HTML
        width=1200,
        height=800,
        resizable=True,
        confirm_quit=True,
        background_color="#000000",
        browser_args=[
            "--enable-geolocation",  # Enable Geolocation API
            "--unsafely-treat-insecure-origin-as-secure=http://localhost",
            "--allow-insecure-localhost"
        ]
    )
    webview.start(debug=True)
