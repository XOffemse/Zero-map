
// ================================
// Global Variables
// ================================
let adapters = [];
let selectedAdapter = null;
let map = null;
let circle = null;
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

function waitForPywebviewReady() {
    return new Promise(resolve => {
        if (window.pywebview && window.pywebview.api) resolve();
        else window.addEventListener('pywebviewready', resolve);
    });
}

function calculateRadiusFromSignal(signalPercent) {
    const min = 5, max = 50;
    if (typeof signalPercent !== 'number' || signalPercent < 0 || signalPercent > 100) return min;
    return min + (signalPercent / 100) * (max - min);
}

// ================================
// Initialization
// ================================
async function init() {
    // Attach Event Listeners
    document.getElementById('refresh-adapters-btn').addEventListener('click', refreshAdapters);
    document.getElementById('refresh-location-btn').addEventListener('click', refreshLocation);
    document.getElementById('search-location-btn').addEventListener('click', searchLocation);
    document.getElementById('use-location-btn').addEventListener('click', useMyLocation);
    document.getElementById('parse-gmap-link-btn').addEventListener('click', () => {
        parseGoogleMapsLink().catch(console.error);
    });
    const scanBtn = document.getElementById('scan-nearby-btn');
    if (scanBtn) scanBtn.addEventListener('click', scanNearbyWifi);

    await loadAdapters();
    initMap();
}

document.addEventListener('DOMContentLoaded', init);

// ================================
// Adapter Management
// ================================
async function loadAdapters() {
    try {
        await waitForPywebviewReady();
        const adaptersJson = await safeApiCall('getAdapters');
        adapters = JSON.parse(adaptersJson);
        if (!Array.isArray(adapters)) throw new Error("Adapters response is not an array");
    } catch (error) {
        alert("Failed to load adapters from backend.");
        console.error("Error fetching adapters:", error);
        adapters = [];
    }
    renderAdaptersList();
    setRefreshLocationButtonState(false);
}

async function refreshAdapters() {
    setRefreshAdaptersButtonState(false);
    await loadAdapters();
    setRefreshAdaptersButtonState(true);
}

function renderAdaptersList() {
    const adaptersDiv = document.getElementById('adapters');
    adaptersDiv.innerHTML = '';
    if (!adapters.length) {
        adaptersDiv.innerHTML = "<p>No Wi-Fi adapters found.</p>";
        return;
    }

    adapters.forEach((adapter, idx) => {
        const div = document.createElement('div');
        div.className = 'adapter-item';
        div.textContent = `${adapter.name} (${adapter.ssid || 'Not connected'})`;
        div.tabIndex = 0;
        div.role = "button";
        div.setAttribute('aria-pressed', 'false');
        div.onclick = () => selectAdapter(idx);
        div.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectAdapter(idx);
            }
        };
        adaptersDiv.appendChild(div);
    });
}

async function selectAdapter(index) {
    selectedAdapter = adapters[index];
    if (!selectedAdapter) return;

    highlightSelectedAdapter(index);
    updateAdapterInfo(selectedAdapter);

    try {
        await safeApiCall('adapterSelected', JSON.stringify(selectedAdapter));
    } catch (err) {
        console.error("Backend update failed:", err);
    }

    setRefreshLocationButtonState(true);

    // Reset map view
    if (map) {
        map.setCenter(new google.maps.LatLng(0, 0));
        map.setZoom(2);
        if (circle) circle.setMap(null);
    }
}

function highlightSelectedAdapter(selectedIndex) {
    const items = document.querySelectorAll('.adapter-item');
    items.forEach((el, idx) => {
        const isSelected = idx === selectedIndex;
        el.classList.toggle('selected', isSelected);
        el.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });
}

function updateAdapterInfo(adapter, lat = null, lon = null, accuracy = null) {
    const infoDiv = document.getElementById('info');
    let locationHtml = '';
    if (lat !== null && lon !== null) {
        locationHtml = accuracy !== null
            ? `<b>Current Location:</b> ${lat.toFixed(6)}, ${lon.toFixed(6)} (±${accuracy} m)<br/>`
            : `<b>Current Location:</b> ${lat.toFixed(6)}, ${lon.toFixed(6)} (Manual Input)<br/>`;
    }
    infoDiv.innerHTML = `
        <b>Name:</b> ${adapter.name} <br/>
        <b>SSID:</b> ${adapter.ssid || 'Not connected'} <br/>
        <b>Signal:</b> ${adapter.signal}% <br/>
        <b>MAC:</b> ${adapter.mac} <br/>
        ${locationHtml}
    `;
}

// ================================
// Map Management
// ================================
function initMap() {
    if (!map) {
        map = new google.maps.Map(document.getElementById('map'), {
            center: { lat: 0, lng: 0 },
            zoom: 2,
            mapTypeId: 'roadmap',
            fullscreenControl: false,
        });
    }
}

function updateMapAndInfo(lat, lon, accuracy = null) {
    if (!map) initMap();

    const center = new google.maps.LatLng(lat, lon);
    map.setCenter(center);
    map.setZoom(17);

    if (circle) circle.setMap(null);

    const radius = Math.min(calculateRadiusFromSignal(selectedAdapter.signal), 50);
    circle = new google.maps.Circle({
        strokeColor: '#3f51b5',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#3f51b5',
        fillOpacity: 0.35,
        map: map,
        center: center,
        radius: radius
    });

    updateAdapterInfo(selectedAdapter, lat, lon, accuracy);
}

// ================================
// Location Functions
// ================================
function refreshLocation() {
    if (!selectedAdapter) {
        alert("Please select a Wi-Fi adapter first.");
        return;
    }
    const lat = document.getElementById('latitude').value.trim();
    const lon = document.getElementById('longitude').value.trim();
    if (!lat || !lon) {
        alert("Please enter latitude and longitude.");
        return;
    }
    searchLocation();
}

function searchLocation() {
    if (!selectedAdapter) {
        alert("Please select a Wi-Fi adapter.");
        return;
    }

    const lat = parseFloat(document.getElementById('latitude').value.trim());
    const lon = parseFloat(document.getElementById('longitude').value.trim());

    if (isNaN(lat) || isNaN(lon)) {
        alert("Invalid coordinates.");
        return;
    }

    updateMapAndInfo(lat, lon, null);
}
async function useMyLocation() {
    if (!selectedAdapter) {
        alert("Please select a Wi-Fi adapter first.");
        return;
    }

    setUseLocationButtonState(false);

    try {
        // Check if running inside PyWebView Chromium
        const isPywebview = !!window.pywebview;

        if (isPywebview && navigator.userAgent.includes("Chrome")) {
            // Force prompt Chromium to ask location permission
            const permission = await navigator.permissions.query({ name: 'geolocation' });
            if (permission.state === 'denied') {
                alert("Location permission is blocked. Please allow location access in Chromium settings.");
                setUseLocationButtonState(true);
                return;
            }
        }

        if (!navigator.geolocation) {
            alert("Geolocation is not supported in this environment.");
            setUseLocationButtonState(true);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            pos => {
                const { latitude, longitude, accuracy } = pos.coords;
                document.getElementById('latitude').value = latitude.toFixed(6);
                document.getElementById('longitude').value = longitude.toFixed(6);
                updateMapAndInfo(latitude, longitude, accuracy);
                setUseLocationButtonState(true);
                setRefreshLocationButtonState(true);
            },
            err => {
                if (err.code === err.PERMISSION_DENIED) {
                    alert("Location permission denied. Please enable location access in your system/browser.");
                } else if (err.code === err.POSITION_UNAVAILABLE) {
                    alert("Location information is unavailable. Are you running inside a virtual machine?");
                } else if (err.code === err.TIMEOUT) {
                    alert("Location request timed out. Try again.");
                } else {
                    alert("Failed to get location: " + err.message);
                }
                setUseLocationButtonState(true);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    } catch (error) {
        console.error("Error requesting location:", error);
        alert("Failed to request location. Check Chromium settings.");
        setUseLocationButtonState(true);
    }
}

// ================================
// Google Maps Link Parsing
// ================================
function parseGoogleMapsLink() {
    const input = document.getElementById('gmap-link').value.trim();
    if (!input) return alert("Enter a Google Maps URL.");

    try {
        const url = new URL(input);
        if (url.hostname === 'maps.app.goo.gl') {
            alert("Shortened URLs not supported. Paste the full link.");
            return;
        }

        // Try !3dLAT!2dLON
        let latMatch = input.match(/!3d(-?\d+\.\d+)/);
        let lonMatch = input.match(/!2d(-?\d+\.\d+)/);
        if (latMatch && lonMatch) {
            const lat = parseFloat(latMatch[1]);
            const lon = parseFloat(lonMatch[1]);
            return updateFromCoords(lat, lon);
        }

        // Try @LAT,LON
        let atMatch = input.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (atMatch) {
            return updateFromCoords(parseFloat(atMatch[1]), parseFloat(atMatch[2]));
        }

        alert("Could not extract coordinates from the URL.");
    } catch {
        alert("Invalid URL format.");
    }
}

function updateFromCoords(lat, lon) {
    if (isNaN(lat) || isNaN(lon)) return alert("Invalid coordinates.");
    document.getElementById('latitude').value = lat.toFixed(6);
    document.getElementById('longitude').value = lon.toFixed(6);

    if (!selectedAdapter) {
        alert("Coordinates set. Now select an adapter.");
        return;
    }

    updateMapAndInfo(lat, lon, null);
    setRefreshLocationButtonState(true);
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

    // Disable button and change text
    scanBtn.disabled = true;
    scanBtn.textContent = "Scanning...";

    try {
        const wifiJson = await safeApiCall('scanNearbyNetworks');
        const networks = JSON.parse(wifiJson);

        // Clear previous markers
        nearbyMarkers.forEach(marker => marker.setMap(null));
        nearbyMarkers = [];

        if (!networks.length) {
            alert('No nearby Wi-Fi networks found.');
        } else {
            // Optionally, you can add markers on the map here
            // (adjust lat/lon offsets or use a fixed location if needed)
        }

        // Update the Wi-Fi scans list immediately after scanning
        await refreshWifiScans();

        // Optionally switch to Wi-Fi Scans screen (if using mode buttons)
        document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
        const scansBtn = document.querySelector('.mode-btn[data-mode="wifi-scans"]');
        if (scansBtn) scansBtn.classList.add('active');

        document.querySelectorAll('.mode-screen').forEach(screen => {
            screen.style.display = 'none';
        });
        const scansScreen = document.getElementById('wifi-scans-screen');
        if (scansScreen) scansScreen.style.display = 'block';

    } catch (error) {
        alert("Failed to scan nearby networks.");
        console.error(error);
    } finally {
        // Re-enable button and reset text after operation completes
        scanBtn.disabled = false;
        scanBtn.textContent = "Scan Nearby Wi-Fi";
    }
}



async function refreshWifiScans() {
    const listEl = document.getElementById('wifi-networks-list');
    listEl.innerHTML = '<li>Scanning for Wi-Fi networks...</li>';

    // Reset selection and disable the select button at the start
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

        // Clear the list
        listEl.innerHTML = '';

        networks.forEach(net => {
            const li = document.createElement('li');
            li.style.padding = '8px 5px';
            li.style.borderBottom = '1px solid #444';
            li.tabIndex = 0;             // Make focusable
            li.role = 'option';          // Accessibility role
            li.classList.remove('selected'); // Reset any selection style

            // Build network info string
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

            // Selection handler
            li.addEventListener('click', () => {
                if (selectedWifiNetwork) {
                    selectedWifiNetwork.classList.remove('selected');
                }
                selectedWifiNetwork = li;
                li.classList.add('selected');

                // Enable Select Network button
                if (selectBtn) selectBtn.disabled = false;
            });


            // Keyboard accessibility: select on Enter or Space
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

document.getElementById('select-wifi-btn').addEventListener('click', () => {
    if (!selectedWifiNetwork) {
        alert("Please select a Wi-Fi network first.");
        return;
    }

    // Extract info from the selected li element (you might want to parse it properly)
    const attackInfo = selectedWifiNetwork.innerText || selectedWifiNetwork.textContent;

    // Save or pass this info to your attacks screen or backend as needed
    // For now, just log or display in attacks panel:
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

    // Switch mode buttons active state
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    const attacksBtn = document.querySelector('.mode-btn[data-mode="attacks"]');
    if (attacksBtn) attacksBtn.classList.add('active');

    // Show attacks screen and hide others
    document.querySelectorAll('.mode-screen').forEach(screen => (screen.style.display = 'none'));
    const attacksScreen = document.getElementById('attacks-screen');
    if (attacksScreen) attacksScreen.style.display = 'block';
});

// Attach event listener to refresh button
document.getElementById('refresh-wifi-scans-btn').addEventListener('click', refreshWifiScans);

// Optionally, refresh on screen show
document.getElementById('refresh-wifi-scans-btn').addEventListener('click', refreshWifiScans);
// ================================
// UI Helpers
// ================================
function setRefreshAdaptersButtonState(enabled) {
    const btn = document.getElementById('refresh-adapters-btn');
    btn.disabled = !enabled;
    btn.classList.toggle('loading', !enabled);
}

function setRefreshLocationButtonState(enabled) {
    const btn = document.getElementById('refresh-location-btn');
    btn.disabled = !enabled;
    btn.classList.toggle('loading', !enabled);
}

function setUseLocationButtonState(enabled) {
    const btn = document.getElementById('use-location-btn');
    btn.disabled = !enabled;
    btn.classList.toggle('loading', !enabled);
}