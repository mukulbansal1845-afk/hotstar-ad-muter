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

    const html = logs.flatMap(({ ts, msg }, i) => {
        const node = `
            <div class="flow-node ${classifyLog(msg)}">
                <span class="dot"></span>
                <span class="node-time">${formatTime(ts)}</span>
                <span class="node-msg">${msg}</span>
            </div>`;
        const arrow = i < logs.length - 1 ? `<div class="flow-arrow">↓</div>` : "";
        return [node, arrow];
    });

    logList.innerHTML = html.join("");
}

function load() {
    chrome.storage.local.get("swLogs", ({ swLogs }) => renderLogs(swLogs || []));
}

document.getElementById("refreshBtn").addEventListener("click", load);

document.getElementById("clearBtn").addEventListener("click", () => {
    chrome.storage.local.set({ swLogs: [] }, load);
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.swLogs) {
        renderLogs(changes.swLogs.newValue || []);
    }
});

load();
