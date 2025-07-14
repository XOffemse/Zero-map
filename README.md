# ⚡ Zero-map

**Zero-Map** is a Wi-Fi radar and attack GUI tool for Linux systems.  
It provides an intuitive interface to monitor nearby wireless networks, visualize their properties, and — in future updates — perform advanced operations such as deauthentication attacks.

Designed for penetration testers, network security researchers, and wireless enthusiasts, Zero-map enables seamless scanning, analysis, and interaction with Wi-Fi networks.

---

## 🔑 Key Features

### ✔ Wi-Fi Radar with Real-Time Visualization
- Scans and lists nearby wireless networks using your Wi-Fi adapter.
- Displays detailed network information:
  - SSID
  - BSSID (MAC Address)
  - Signal Strength
  - Encryption Type
  - Channel
- Location-based radar with a **blue circular radius** to visually map networks around you.

### ✔ Graphical User Interface (GUI)
- Clean, modern, and beginner-friendly GUI built with **PyWebView**.

---

## 🚧 Upcoming Features

- **Deauthentication Attacks:** Simulate Wi-Fi disconnect attacks (coming soon).
- **Packet Sniffing:** Capture and analyze wireless traffic in real-time.
- **Enhanced Radar Visualization:** Interactive radar with dynamic range control.
- **Session Management:** Save and reload previous scans and sessions.

---

## 💻 Installation Guide (Linux)

### Step 1: Clone the Repository

```
git clone https://github.com/XOffemse/Zero-map.git
```

```
cd Zero-map
```
### Step 2: Run the installer

```
chmod a+x install.sh
```

```
sudo ./install.sh
```

### Step 3: Activate the newly created Virtual Enviroment

```
source /bin/activate
```

### Step 4: Run the Application

```
python3 main.py
```



## ⚠️ Disclaimer

This tool is intended for educational and authorized penetration testing purposes only.  
Unauthorized use on networks you do not own or have permission to test may violate local laws.

---

## 🚀 Future Roadmap

- Advanced location-based Wi-Fi mapping
- Attack modules with customization options
- Exportable reports for network audits


