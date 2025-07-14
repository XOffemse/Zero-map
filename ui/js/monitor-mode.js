// ================================
// Monitor Mode Standalone Logic
// ================================

// Local variables for modal
let modalAdapters = [];
let modalSelectedAdapter = null;
let modalSelectedAction = null; // start or stop
let isMonitorModeEnabled = false; // Track monitor mode state

// Grab modal elements
const monitorModeBtn = document.getElementById('monitor-mode-btn');
const monitorModeModal = document.getElementById('monitor-mode-modal');
const monitorModeCloseBtn = document.getElementById('monitor-mode-close-btn');
const interfaceListEl = document.getElementById('interface-list');
const nextBtn = document.getElementById('next-btn');
const cancelBtn = document.getElementById('cancel-btn');
const backBtn = document.getElementById('back-btn');
const applyBtn = document.getElementById('apply-btn');
const step1El = document.getElementById('step-1');
const step2El = document.getElementById('step-2');
const actionListEl = document.getElementById('action-list');

// Reference Stop Monitor Mode item
const stopMonitorItem = actionListEl.querySelector('li[data-action="stop"]');

// ================================
// Utility Helpers
// ================================
async function modalSafeApiCall(method, ...args) {
    try {
        if (!window.pywebview || !window.pywebview.api || typeof window.pywebview.api[method] !== 'function') {
            throw new Error(`API method ${method} not available`);
        }
        return await window.pywebview.api[method](...args);
    } catch (err) {
        console.error(`Monitor Mode API call failed [${method}]:`, err);
        throw err;
    }
}

function waitForPywebviewReady() {
    return new Promise(resolve => {
        if (window.pywebview && window.pywebview.api) resolve();
        else window.addEventListener('pywebviewready', resolve);
    });
}

function resetModal() {
    // Reset to step 1
    step1El.style.display = 'block';
    step2El.style.display = 'none';
    modalSelectedAdapter = null;
    modalSelectedAction = null;
    nextBtn.disabled = true;
    applyBtn.disabled = true;

    // Clear selected states
    document.querySelectorAll('#interface-list li').forEach(li => li.classList.remove('selected'));
    document.querySelectorAll('#action-list li').forEach(li => li.classList.remove('selected'));

    // Update Stop Monitor Mode availability
    updateStopMonitorState();
}

function updateStopMonitorState() {
    if (isMonitorModeEnabled) {
        stopMonitorItem.classList.remove('disabled'); // Enable Stop action
        stopMonitorItem.style.pointerEvents = "auto";
    } else {
        stopMonitorItem.classList.add('disabled'); // Disable Stop action
        stopMonitorItem.style.pointerEvents = "none";
    }
}

// ================================
// Modal Event Bindings
// ================================

// Open modal and fetch fresh adapters
monitorModeBtn.addEventListener('click', async () => {
    resetModal();
    monitorModeModal.style.display = 'block';
    await refreshModalAdapters();
});

// Close modal on button click
monitorModeCloseBtn.addEventListener('click', () => {
    monitorModeModal.style.display = 'none';
});

// Close modal on outside click
window.addEventListener('click', (e) => {
    if (e.target === monitorModeModal) {
        monitorModeModal.style.display = 'none';
    }
});

// Cancel button (closes modal)
cancelBtn.addEventListener('click', () => {
    monitorModeModal.style.display = 'none';
});

// Next button (go to step 2)
nextBtn.addEventListener('click', () => {
    if (modalSelectedAdapter) {
        step1El.style.display = 'none';
        step2El.style.display = 'block';
    }
});

// Back button (return to step 1)
backBtn.addEventListener('click', () => {
    step2El.style.display = 'none';
    step1El.style.display = 'block';
    modalSelectedAction = null;
    applyBtn.disabled = true;

    // Clear action selections
    document.querySelectorAll('#action-list li').forEach(li => li.classList.remove('selected'));
});

// Apply button (send start/stop command)
applyBtn.addEventListener('click', async () => {
    if (modalSelectedAdapter && modalSelectedAction) {
        console.log(`Applying action: ${modalSelectedAction} on adapter:`, modalSelectedAdapter);

        try {
            await modalSafeApiCall('monitorModeAction', JSON.stringify({
                adapter: modalSelectedAdapter,
                action: modalSelectedAction
            }));
            console.log("Monitor Mode action applied successfully.");

            // Update state after applying action
            if (modalSelectedAction === "start") {
                isMonitorModeEnabled = true;
            } else if (modalSelectedAction === "stop") {
                isMonitorModeEnabled = false;
            }
            updateStopMonitorState();
        } catch (err) {
            console.error("Failed to apply monitor mode action:", err);
        }

        monitorModeModal.style.display = 'none';
    }
});

// ================================
// Adapter Management for Modal
// ================================
async function refreshModalAdapters() {
    try {
        await waitForPywebviewReady();

        // Fetch adapters fresh from backend
        const adaptersJson = await modalSafeApiCall('getAdapters');
        modalAdapters = JSON.parse(adaptersJson);
        console.log("[Monitor Modal] Fetched adapters:", modalAdapters);

        renderModalAdaptersList();
    } catch (err) {
        interfaceListEl.innerHTML = '<li>Error loading adapters.</li>';
    }
}

function renderModalAdaptersList() {
    interfaceListEl.innerHTML = ''; // Clear old list

    if (!modalAdapters.length) {
        interfaceListEl.innerHTML = '<li>No adapters found.</li>';
        nextBtn.disabled = true;
        return;
    }

    modalAdapters.forEach((adapter, idx) => {
        const li = document.createElement('li');
        li.textContent = `${adapter.name} (${adapter.ssid || 'Not connected'})`;
        li.classList.add('interface-item');
        li.tabIndex = 0;

        // Click/keyboard select handler
        li.addEventListener('click', () => modalSelectAdapter(idx));
        li.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                modalSelectAdapter(idx);
            }
        });

        interfaceListEl.appendChild(li);
    });
}

function modalSelectAdapter(index) {
    modalSelectedAdapter = modalAdapters[index];
    console.log("[Monitor Modal] Selected adapter:", modalSelectedAdapter);

    // Highlight selected adapter
    document.querySelectorAll('#interface-list li').forEach(li => li.classList.remove('selected'));
    interfaceListEl.children[index].classList.add('selected');

    nextBtn.disabled = false;
}

// ================================
// Action Selection for Step 2
// ================================
actionListEl.addEventListener('click', (e) => {
    if (e.target.tagName === 'LI' && !e.target.classList.contains('disabled')) {
        document.querySelectorAll('#action-list li').forEach(li => li.classList.remove('selected'));
        e.target.classList.add('selected');
        modalSelectedAction = e.target.getAttribute('data-action');
        console.log("[Monitor Modal] Selected action:", modalSelectedAction);
        applyBtn.disabled = false;
    }
});
