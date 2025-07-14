 

def scan_wifi_networks(interface_name=None):
    wifi = pywifi.PyWiFi()
    iface = None

    if interface_name:
        for i in wifi.interfaces():
            if i.name() == interface_name:
                iface = i
                break
        if not iface:
            raise Exception(f"Interface {interface_name} not found")
    else:
        iface = wifi.interfaces()[0]

    iface.scan()
    time.sleep(3)  # Wait for scan to complete

    results = iface.scan_results()

    networks = []
    for network in results:
        networks.append({
            "ssid": network.ssid,
            "bssid": network.bssid,
            "signal": network.signal,
            "freq": network.freq,
            "auth": network.auth,
            "akm": network.akm,
            "cipher": network.cipher,
        })
    return networks
