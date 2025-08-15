import os
import json
import subprocess
import threading
import time
import csv
import requests
import base64
import platform
import webview
from flask import Flask, request, jsonify

# --------------------------
# WiGLE API Credentials
# --------------------------
WIGLE_API_NAME = "AIDb8bae0cbb42918cbc072b20a2968bc40"
WIGLE_API_TOKEN = "dcf8c95cfefcbcc32e338de89fa37763"

# --------------------------
# WiGLE Location Lookup
# --------------------------
def get_location_from_wigle(bssid):
    try:
        auth_str = f"{WIGLE_API_NAME}:{WIGLE_API_TOKEN}"
        auth_encoded = base64.b64encode(auth_str.encode()).decode()
        headers = {
            "Authorization": f"Basic {auth_encoded}",
            "Accept": "application/json"
        }
        url = f"https://api.wigle.net/api/v2/network/search?netid={bssid}"
        response = requests.get(url, headers=headers, timeout=10)

        if response.status_code == 200:
            data = response.json()
            if data.get("success") and data.get("totalResults", 0) > 0:
                first_result = data["results"][0]
                return {
                    "lat": first_result.get("trilat"),
                    "lon": first_result.get("trilong")
                }
        return None
    except Exception as e:
        print(f"[WiGLE] Error fetching location for {bssid}: {e}")
        return None

# --------------------------
# Wi-Fi Scan with Airodump
# --------------------------
def scan_wifi_networks(interface_name="wlan0", duration=7, password=None):
    try:
        # Put interface into monitor mode
        print(f"[Monitor Mode] Enabling monitor mode on {interface_name}...")
        subprocess.run(["sudo", "ip", "link", "set", interface_name, "down"], check=True)
        subprocess.run(["sudo", "iw", interface_name, "set", "monitor", "control"], check=True)
        subprocess.run(["sudo", "ip", "link", "set", interface_name, "up"], check=True)
        print(f"[Monitor Mode] {interface_name} is now in monitor mode.")

        current_dir = os.path.dirname(os.path.abspath(__file__))
        scans_dir = os.path.join(current_dir, "scans")
        os.makedirs(scans_dir, exist_ok=True)

        output_file = os.path.join(scans_dir, "airodump_scan")
        csv_file = f"{output_file}-01.csv"

        if os.path.exists(csv_file):
            os.remove(csv_file)

        cmd = [
            "airodump-ng",
            interface_name,
            "--write-interval", "1",
            "--output-format", "csv",
            "--write", output_file
        ]
        print(f"[Scanner] Running: {' '.join(cmd)}")

        if password:
            process = subprocess.Popen(['pkexec'] + cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, encoding='utf-8')
        else:
            process = subprocess.Popen(['sudo'] + cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

        print(f"[Scanner] Scanning for {duration} seconds...")
        time.sleep(duration)

        process.terminate()
        process.wait()
        print("[Scanner] Scan completed.")

        # Put interface back into managed mode
        print(f"[Monitor Mode] Restoring {interface_name} to managed mode...")
        subprocess.run(["sudo", "ip", "link", "set", interface_name, "down"], check=True)
        subprocess.run(["sudo", "iw", interface_name, "set", "type", "managed"], check=True)
        subprocess.run(["sudo", "ip", "link", "set", interface_name, "up"], check=True)
        print(f"[Monitor Mode] {interface_name} is now back in managed mode.")

        networks = []
        if os.path.exists(csv_file):
            with open(csv_file, "r", encoding="utf-8", errors="ignore") as f:
                reader = csv.reader(f)
                for row in reader:
                    if len(row) < 14 or row[0].strip() == "BSSID":
                        continue
                    bssid = row[0].strip()
                    channel = row[3].strip()
                    signal = row[8].strip()
                    encryption = row[5].strip()
                    ssid = row[13].strip()

                    location = get_location_from_wigle(bssid)

                    networks.append({
                        "ssid": ssid,
                        "bssid": bssid,
                        "channel": channel,
                        "signal": signal,
                        "encryption": encryption,
                        "location": location
                    })
        else:
            print("[Scanner] No CSV output found.")

        return networks

    except subprocess.CalledProcessError as e:
        print(f"[Scanner] Command error: {e}")
        return []
    except Exception as e:
        print(f"[Scanner] Unexpected error: {e}")
        return []
    finally:
        # Safety restore managed mode in case of error
        try:
            subprocess.run(["sudo", "ip", "link", "set", interface_name, "down"], check=True)
            subprocess.run(["sudo", "iw", interface_name, "set", "type", "managed"], check=True)
            subprocess.run(["sudo", "ip", "link", "set", interface_name, "up"], check=True)
        except Exception:
            pass
        try:
            if os.path.exists(csv_file):
                os.remove(csv_file)
        except Exception:
            pass


# --------------------------
# Adapter Listing (Linux)
# --------------------------
def get_adapters_linux():
    adapters = []
    try:
        output = subprocess.check_output(["nmcli", "-t", "-f", "DEVICE,TYPE", "device"], text=True)
        for line in output.splitlines():
            if not line.strip():
                continue
            device, dtype = line.split(":")
            if dtype == "wifi":
                adapters.append({"interface": device, "type": dtype})
    except Exception as e:
        print(f"[Adapters] Error fetching adapters: {e}")
    return adapters

# --------------------------
# API for PyWebView
# --------------------------
current_selected_adapter = None

class Api:
    def getAdapters(self):
        return json.dumps(get_adapters_linux())

    def adapterSelected(self, adapter_json):
        global current_selected_adapter
        adapter = json.loads(adapter_json)
        current_selected_adapter = adapter.get("interface")
        print(f"[INFO] Adapter selected: {current_selected_adapter}")
        return "OK"

    def scanNearbyNetworks(self, adapter_interface):
        try:
            print(f"[INFO] Starting scan on {adapter_interface}")
            results = scan_wifi_networks(adapter_interface, duration=10)
            return json.dumps(results)
        except Exception as e:
            print(f"[ERROR] Wi-Fi scan failed: {e}")
            return json.dumps([])

# --------------------------
# Flask App for Webview
# --------------------------
flask_app = Flask(__name__)

@flask_app.route("/api/adapters", methods=["GET"])
def api_get_adapters():
    return jsonify(get_adapters_linux())

@flask_app.route("/api/scan", methods=["POST"])
def api_scan():
    data = request.json
    adapter = data.get("adapter")
    results = scan_wifi_networks(adapter, duration=10)
    return jsonify(results)

def start_flask():
    flask_app.run(host="127.0.0.1", port=5000)

# --------------------------
# Main
# --------------------------
if __name__ == "__main__":
    threading.Thread(target=start_flask, daemon=True).start()
    webview.create_window("Wi-Fi Scanner", "http://127.0.0.1:5000", width=1000, height=700)
    webview.start()
