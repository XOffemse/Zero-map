// app.js

// ================================
// Global Variables
// ================================
let adapters = [];
let selectedAdapter = null;
let map = null;
let circle = null;

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
        adaptersDiv.innerHTML = "<p>No adapters found.</p>";
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

    if (window.setSelectedAdapter) {
        // Send the adapter interface name to wifiscans.js
        window.setSelectedAdapter(selectedAdapter.interface);
    }

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
        <b>Signal:</b> ${adapter.signal || 'N/A'}% <br/>
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

    const radius = Math.min(calculateRadiusFromSignal(selectedAdapter?.signal), 50);
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
        alert("Please select an adapter first.");
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
        alert("Please select an adapter.");
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
        alert("Please select an adapter first.");
        return;
    }

    setUseLocationButtonState(false);

    try {
        const isPywebview = !!window.pywebview;

        if (isPywebview && navigator.userAgent.includes("Chrome")) {
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
