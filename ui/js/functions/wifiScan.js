// ================================
// Global Variables
// ================================
let nearbyMarkers = []; // Track nearby network markers
let selectedWifiNetwork = null;
let currentSelectedAdapter = null; // 🆕 Track the selected adapter globally

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
// Adapter Selection Helper 🆕
// ================================
function ensureAdapterSelected() {
  if (!currentSelectedAdapter) {
    console.warn("No adapter selected in wifiscans.js");
    alert("Please select a Wi-Fi adapter first.");
    document.getElementById('adapter-list')?.classList.add('open'); // Open sidebar
    return false;
  }
  return true;
}

// Called from adapterMap.js when user selects an adapter
function setSelectedAdapter(adapter) {
  if (typeof adapter === 'object') {
    // If full adapter object is passed, extract the interface
    currentSelectedAdapter = adapter.interface || null;
    console.log("Adapter object received in wifiscans.js:", adapter);
  } else {
    // If only interface name is passed
    currentSelectedAdapter = adapter;
    console.log("Adapter interface set in wifiscans.js:", adapter);
  }
}
window.setSelectedAdapter = setSelectedAdapter; // 🆕 Expose globally

// ================================
// Scan Nearby Wi-Fi
// ================================
async function scanNearbyWifi() {
  if (!ensureAdapterSelected()) return;

  const scanBtn = document.getElementById('scan-nearby-btn');
  if (!scanBtn) {
    console.error("Scan Nearby button not found.");
    return;
  }

  scanBtn.disabled = true;
  scanBtn.textContent = "Scanning...";

  try {
    const wifiJson = await safeApiCall('scanNearbyNetworks', currentSelectedAdapter); // 🆕 Pass adapter
    const networks = JSON.parse(wifiJson);

    // Clear existing markers
    nearbyMarkers.forEach(marker => marker.setMap && marker.setMap(null));
    nearbyMarkers = [];

    if (!networks.length) {
      alert('No nearby Wi-Fi networks found.');
    } else {
      console.log(`Found ${networks.length} networks.`);
    }

    await refreshWifiScans();

    // Switch to Wi-Fi Scans screen
    switchToScreen('wifi-scans');

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
  if (!ensureAdapterSelected()) return;

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
    const wifiJson = await safeApiCall('scanNearbyNetworks', currentSelectedAdapter); // 🆕 Pass adapter
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
// Switch Between Screens
// ================================
function switchToScreen(screenName) {
  document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
  const btn = document.querySelector(`.mode-btn[data-mode="${screenName}"]`);
  if (btn) btn.classList.add('active');

  document.querySelectorAll('.mode-screen').forEach(screen => (screen.style.display = 'none'));
  const targetScreen = document.getElementById(`${screenName}-screen`);
  if (targetScreen) targetScreen.style.display = 'block';
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

      switchToScreen('attacks');
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
