import webview
import json
import os
import threading
from flask import Flask, request, jsonify, send_from_directory
from adapter_utils import get_adapters
from adapter_utils.wifi_scanner import scan_wifi_networks  # Import your scanner function
from adapter_utils.monitor_mode_api import MonitorModeAPI

# === Flask Setup ===
app = Flask(__name__, static_folder='ui')

# Ensure auth.json is stored relative to this script's folder
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CREDENTIALS_FILE = os.path.join(BASE_DIR, 'auth.json')

# Create monitor mode API instance
monitor_mode_api = MonitorModeAPI()

# === JS API for WebView ===
class API:
    def __init__(self):
        pass

    def getAdapters(self):
        """Return a list of adapters"""
        try:
            adapters = get_adapters()
            return json.dumps(adapters)
        except Exception as e:
            print("[API] Error in getAdapters:", e)
            return json.dumps([])

    def adapterSelected(self, adapter_json):
        """Handle adapter selection from frontend"""
        try:
            adapter = json.loads(adapter_json)
            print("[API] Selected adapter:", adapter)
            return "OK"
        except Exception as e:
            print("[API] Error in adapterSelected:", e)
            return "Error"

    def scanNearbyNetworks(self):
        """Scan for nearby Wi-Fi networks"""
        try:
            networks = scan_wifi_networks()
            return json.dumps(networks)
        except Exception as e:
            print("[API] Error scanning networks:", e)
            return json.dumps([])

    def monitorModeAction(self, payload_json):
        """Enable or disable monitor mode"""
        try:
            result = monitor_mode_api.monitorModeAction(payload_json)
            print("[API] Monitor Mode action result:", result)
            return result
        except Exception as e:
            print("[API] Error in monitorModeAction:", e)
            return f"Error: {e}"

# === Flask Routes ===
@app.route('/')
def root():
    """Serve the initial page based on setup state"""
    if not os.path.exists(CREDENTIALS_FILE):
        return send_from_directory('ui', 'setup.html')
    return send_from_directory('ui', 'login.html')

@app.route('/dashboard')
def dashboard():
    return send_from_directory('ui', 'dashboard.html')

@app.route('/set-credentials', methods=['POST'])
def set_credentials():
    """Save user credentials"""
    data = request.json
    with open(CREDENTIALS_FILE, 'w') as f:
        json.dump(data, f)
    return jsonify({"status": "saved"})

@app.route('/login', methods=['POST'])
def login():
    """Validate login credentials"""
    if not os.path.exists(CREDENTIALS_FILE):
        return jsonify({"error": "Not configured"}), 400

    data = request.json
    with open(CREDENTIALS_FILE, 'r') as f:
        saved = json.load(f)

    if data['username'] == saved['username'] and data['password'] == saved['password']:
        return jsonify({"status": "success"})
    else:
        return jsonify({"error": "Invalid"}), 401

@app.route('/<path:path>')
def serve_static(path):
    """Serve static files from ui directory"""
    return send_from_directory('ui', path)

# === WebView Launcher ===
def start_flask():
    """Start Flask server"""
    app.run(port=5000, debug=False, use_reloader=False)

if __name__ == "__main__":
    api = API()

    # Start Flask server in background thread
    flask_thread = threading.Thread(target=start_flask)
    flask_thread.daemon = True
    flask_thread.start()

    import time
    time.sleep(1)  # Give Flask server a moment to start

    # Create the WebView window
    webview.create_window(
        "Zero-Map",
        "http://localhost:5000",
        js_api=api,
        width=900,
        height=700,
        resizable=True
    )
    webview.start()
