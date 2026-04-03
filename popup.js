const toggleBtn = document.getElementById("toggleBtn");
const logsBtn = document.getElementById("logsBtn");

function setUI(enabled) {
    if (enabled) {
        toggleBtn.className = "toggle-btn enabled";
        toggleBtn.innerHTML = '<span class="status-dot"></span>Enabled';
    } else {
        toggleBtn.className = "toggle-btn disabled";
        toggleBtn.innerHTML = '<span class="status-dot"></span>Disabled';
    }
}

chrome.storage.local.get("enabled", ({ enabled }) => {
    setUI(enabled !== false);
});

toggleBtn.addEventListener("click", () => {
    chrome.storage.local.get("enabled", ({ enabled }) => {
        const next = enabled === false; // currently disabled → enable, otherwise disable
        chrome.storage.local.set({ enabled: next });
        setUI(next);
    });
});

logsBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("logs.html") });
});
