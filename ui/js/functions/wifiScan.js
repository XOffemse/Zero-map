// wifiScan.js

// ================================
// Global Variables
// ================================
let nearbyMarkers = []; // Track nearby network markers
let selectedWifiNetwork = null;

// ================================
// Utility Functions
// ================================
async function safeApiCall(method, ...args) {
  try {
    if (!window.pywebview || !window.pywebview.api || typeof window.pywebview.api[method] !== 'function') {
      throw new Error(`API method ${method} not available`);
    }
    return await window.pywebview.api[method](...args);
  } catch (error) {
    console.error(`Error calling API method ${method}:`, error);
    throw error;
  }
}

// ================================
// Scan Nearby Wi-Fi
// ================================
async function scanNearbyWifi() {
  const scanBtn = document.getElementById('scan-nearby-btn');
  if (!scanBtn) {
    console.error("Scan Nearby button not found.");
    return;
  }

  scanBtn.disabled = true;
  scanBtn.textContent = "Scanning...";

  try {
    const wifiJson = await safeApiCall('scanNearbyNetworks');
    const networks = JSON.parse(wifiJson);

    nearbyMarkers.forEach(marker => marker.setMap && marker.setMap(null));
    nearbyMarkers = [];

    if (!networks.length) {
      alert('No nearby Wi-Fi networks found.');
    } else {
      // Optionally add markers on map here if needed
    }

    await refreshWifiScans();

    // Switch to Wi-Fi Scans screen
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    const scansBtn = document.querySelector('.mode-btn[data-mode="wifi-scans"]');
    if (scansBtn) scansBtn.classList.add('active');

    document.querySelectorAll('.mode-screen').forEach(screen => (screen.style.display = 'none'));
    const scansScreen = document.getElementById('wifi-scans-screen');
    if (scansScreen) scansScreen.style.display = 'block';

  } catch (error) {
    alert("Failed to scan nearby networks.");
    console.error(error);
  } finally {
    scanBtn.disabled = false;
    scanBtn.textContent = "Search for Wi-Fi";
  }
}

// ================================
// Refresh Wi-Fi Scan List
// ================================
async function refreshWifiScans() {
  const listEl = document.getElementById('wifi-networks-list');
  if (!listEl) {
    console.error("Wi-Fi networks list element not found.");
    return;
  }

  listEl.innerHTML = '<li>Scanning for Wi-Fi networks...</li>';

  selectedWifiNetwork = null;

  const selectBtn = document.getElementById('select-wifi-btn');
  if (selectBtn) selectBtn.disabled = true;

  try {
    const wifiJson = await safeApiCall('scanNearbyNetworks');
    const networks = JSON.parse(wifiJson);

    if (!networks.length) {
      listEl.innerHTML = '<li>No Wi-Fi networks found.</li>';
      return;
    }

    listEl.innerHTML = '';

    networks.forEach(net => {
      const li = document.createElement('li');
      li.style.padding = '8px 5px';
      li.style.borderBottom = '1px solid #444';
      li.tabIndex = 0;
      li.role = 'option';
      li.classList.remove('selected');

      const ssid = net.ssid || "<i>Hidden SSID</i>";
      const bssid = net.bssid || "N/A";
      const signal = net.signal !== undefined ? net.signal + "%" : "N/A";
      const freq = net.freq || "N/A";
      const auth = net.auth || "N/A";

      li.innerHTML = `<strong>SSID:</strong> ${ssid}<br/>
                      <strong>BSSID:</strong> ${bssid}<br/>
                      <strong>Signal:</strong> ${signal}<br/>
                      <strong>Frequency:</strong> ${freq} MHz<br/>
                      <strong>Auth:</strong> ${auth}`;

      li.addEventListener('click', () => {
        if (selectedWifiNetwork) {
          selectedWifiNetwork.classList.remove('selected');
        }
        selectedWifiNetwork = li;
        li.classList.add('selected');
        if (selectBtn) selectBtn.disabled = false;
      });

      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          li.click();
        }
      });

      listEl.appendChild(li);
    });

  } catch (error) {
    listEl.innerHTML = '<li>Error scanning networks.</li>';
    console.error("Wi-Fi scan error:", error);
  }
}

// ================================
// Setup Event Listeners after DOM is ready
// ================================
document.addEventListener('DOMContentLoaded', () => {
  const selectBtn = document.getElementById('select-wifi-btn');
  if (selectBtn) {
    selectBtn.addEventListener('click', () => {
      if (!selectedWifiNetwork) {
        alert("Please select a Wi-Fi network first.");
        return;
      }

      const attackInfo = selectedWifiNetwork.innerText || selectedWifiNetwork.textContent;

      const attacksScreenSection = document.querySelector('#attacks-screen section');
      if (attacksScreenSection) {
        attacksScreenSection.innerHTML = `
          <h2>Attacks Panel</h2>
          <p>Selected Wi-Fi Network Info:</p>
          <pre style="white-space: pre-wrap;">${attackInfo}</pre>
          <button>Run Attack</button>
          <button>Stop Attack</button>
        `;
      }

      document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
      const attacksBtn = document.querySelector('.mode-btn[data-mode="attacks"]');
      if (attacksBtn) attacksBtn.classList.add('active');

      document.querySelectorAll('.mode-screen').forEach(screen => (screen.style.display = 'none'));
      const attacksScreen = document.getElementById('attacks-screen');
      if (attacksScreen) attacksScreen.style.display = 'block';
    });
  }

  const refreshBtn = document.getElementById('refresh-wifi-scans-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', refreshWifiScans);
  }

  const scanBtn = document.getElementById('scan-nearby-btn');
  if (scanBtn) {
    scanBtn.addEventListener('click', scanNearbyWifi);
  }
});
