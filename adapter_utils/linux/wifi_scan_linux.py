import subprocess
import time
import os
import csv

def scan_wifi_networks(interface_name="wlan0", duration=5, password=None):
    """
    Scan Wi-Fi networks on Linux using airodump-ng.
    Saves scan output in a 'scans' folder two directories above this script.
    """
    try:
        # Get absolute path to 'scans' folder two levels up
        current_dir = os.path.dirname(os.path.abspath(__file__))
        scans_dir = os.path.abspath(os.path.join(current_dir, "..", "..", "scans"))
        os.makedirs(scans_dir, exist_ok=True)

        # Prepare file paths
        output_file = os.path.join(scans_dir, "airodump_scan")
        csv_file = f"{output_file}-01.csv"

        # Clean up old scan file
        if os.path.exists(csv_file):
            os.remove(csv_file)

        # Prepare airodump-ng command
        cmd = [
            "airodump-ng",
            interface_name,
            "--write-interval", "1",
            "--output-format", "csv",
            "--write", output_file
        ]
        print(f"[Scanner] Running command: {' '.join(cmd)}")
        print(f"[Scanner] Output will be saved in: {csv_file}")

        if password:
            # Run with sudo and supply password
            process = subprocess.Popen(
                ['pkexec'] + cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                encoding='utf-8'
            )
        else:
            # Run without password (assume sudo session active)
            process = subprocess.Popen(
                ['sudo'] + cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )

        # Let airodump-ng run for the given duration
        print(f"[Scanner] Scanning for {duration} seconds...")
        time.sleep(duration)

        # Stop scanning
        process.terminate()
        process.wait()
        print("[Scanner] Scan completed.")

        # Parse CSV output
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

                    networks.append({
                        "ssid": ssid,
                        "bssid": bssid,
                        "channel": channel,
                        "signal": signal,
                        "encryption": encryption,
                    })
        else:
            print("[Scanner] No CSV output found.")

        return networks

    except subprocess.CalledProcessError as e:
        print(f"[Scanner] Error (sudo failed?): {e}")
        return []
    except Exception as e:
        print(f"[Scanner] Unexpected error: {e}")
        return []
    finally:
        # Clean up CSV file
        try:
            if os.path.exists(csv_file):
                os.remove(csv_file)
        except Exception:
            pass
