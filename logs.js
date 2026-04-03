const logList = document.getElementById("log-list");

function classifyLog(msg) {
    if (/muting/i.test(msg)) return "muted";
    if (/unmut/i.test(msg)) return "unmuted";
    return "info";
}

function formatTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function renderLogs(logs) {
    if (!logs || logs.length === 0) {
        logList.innerHTML = '<p class="empty">No logs yet. Play something on Hotstar and ads will appear here.</p>';
        return;
    }

    logList.innerHTML = [...logs].reverse().map(({ ts, msg }) => `
        <div class="log-entry ${classifyLog(msg)}">
            <span class="log-time">${formatTime(ts)}</span>
            <span class="log-msg">${msg}</span>
        </div>
    `).join("");
}

function load() {
    chrome.storage.local.get("swLogs", ({ swLogs }) => renderLogs(swLogs || []));
}

document.getElementById("refreshBtn").addEventListener("click", load);

document.getElementById("clearBtn").addEventListener("click", () => {
    chrome.storage.local.set({ swLogs: [] }, load);
});

load();
