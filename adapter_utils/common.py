def estimate_range_from_signal(signal_percent):
    """Estimate Wi-Fi range in meters from signal strength (0–100%)."""
    min_range = 5
    max_range = 100
    try:
        signal = int(signal_percent)
        signal = max(0, min(100, signal))
        return round(min_range + (signal / 100) * (max_range - min_range), 2)
    except:
        return min_range
