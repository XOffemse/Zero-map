import subprocess
import re

def scan_wifi_networks():
    """
    Scan Wi-Fi networks on Windows using netsh.
    """
    try:
        output = subprocess.check_output(
            ["netsh", "wlan", "show", "networks", "mode=bssid"],
            encoding='utf-8', errors='ignore'
        )
    except subprocess.CalledProcessError as e:
        print(f"[!] Error running netsh: {e}")
        return []

    networks = []
    blocks = output.split('\n\n')
    for block in blocks:
        ssid_match = re.search(r'SSID\s+\d+\s+:\s(.+)', block)
        if not ssid_match:
            continue
        ssid = ssid_match.group(1).strip()

        bssid_matches = re.findall(r'BSSID\s+\d+\s+:\s([0-9a-fA-F:]+)', block)
        signal_matches = re.findall(r'Signal\s+:\s(\d+)%', block)
        auth_match = re.search(r'Authentication\s+:\s(.+)', block)
        freq_match = re.search(r'Frequency\s+:\s(.+)', block)

        for idx, bssid in enumerate(bssid_matches):
            signal = int(signal_matches[idx]) if idx < len(signal_matches) else None
            networks.append({
                "ssid": ssid,
                "bssid": bssid,
                "signal": signal,
                "freq": freq_match.group(1).strip() if freq_match else None,
                "auth": auth_match.group(1).strip() if auth_match else None,
                "akm": None,
                "cipher": None,
            })
    return networks
