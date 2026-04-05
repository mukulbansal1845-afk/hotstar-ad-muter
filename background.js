import { updateIcon } from "./icon.js";

const durationRegexes = [
    /_VCTA_(\d{1,3})/i,
    /(\d{1,3})s(?:Eng(?:lish)?|Hin(?:di)?)/i,
    /(?:HIN|ENG|HINDI|ENGLISH)_\D*(\d{1,3})/i
];

const muteTimers = new Map();

async function addLog(msg) {
    console.log(msg);
    const { swLogs = [] } = await chrome.storage.local.get("swLogs");
    swLogs.push({ ts: Date.now(), msg });
    if (swLogs.length > 200) swLogs.splice(0, swLogs.length - 200);
    chrome.storage.local.set({ swLogs });
}

async function isEnabled() {
    const { enabled } = await chrome.storage.local.get("enabled");
    return enabled !== false;
}

// --- Mute deadline persistence ---
// Survives SW restarts; lets recoverMutes() pick up where we left off.

function muteKey(tabId) { return `mute_${tabId}`; }

async function saveMuteDeadline(tabId, muteUntil) {
    await chrome.storage.local.set({ [muteKey(tabId)]: muteUntil });
}

// --- Keepalive ---
// Chrome kills the SW after 30s of inactivity. Any Chrome API call resets that
// clock. We poll every 20s while any mute is active so the SW stays alive and
// in-memory setTimeout timers actually fire.

let keepaliveInterval = null;

function startKeepalive() {
    if (keepaliveInterval !== null) return;
    keepaliveInterval = setInterval(() => {
        if (muteTimers.size === 0) {
            clearInterval(keepaliveInterval);
            keepaliveInterval = null;
            return;
        }
        // Lightweight call — just enough to reset the idle timer.
        chrome.tabs.query({ url: "*://*.hotstar.com/*" });
    }, 20_000);
}

// --- Core mute / unmute ---

function scheduleMuteTimer(tabId, msRemaining) {
    const existing = muteTimers.get(tabId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => unmuteTab(tabId, "timer"), msRemaining);
    muteTimers.set(tabId, timer);
    startKeepalive();
}

async function unmuteTab(tabId, reason = "timer") {
    // If a fresh deadline is still well in the future a new ad arrived concurrently
    // — this call is stale; leave the new deadline intact.
    const stored = await chrome.storage.local.get(muteKey(tabId));
    const deadline = stored[muteKey(tabId)];
    if (deadline && deadline > Date.now() + 2000) {
        muteTimers.delete(tabId);
        return;
    }

    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (tab?.mutedInfo?.muted) {
        chrome.tabs.update(tabId, { muted: false });
        await addLog(reason === "content" ? "Content resumed — unmuted ✅" : "Ad time elapsed — unmuted ✅");
    }
    chrome.tabs.sendMessage(tabId, { type: "STOP_WATCHING" }).catch(() => {});
    muteTimers.delete(tabId);
    chrome.storage.local.remove(muteKey(tabId));
}

// On startup, recover any mutes that were active before the SW was killed.
async function recoverMutes() {
    const all = await chrome.storage.local.get(null);
    const now = Date.now();
    for (const [key, muteUntil] of Object.entries(all)) {
        if (!key.startsWith("mute_")) continue;
        const tabId = parseInt(key.replace("mute_", ""), 10);
        const remaining = muteUntil - now;
        if (remaining <= 0) {
            unmuteTab(tabId, "timer");
        } else {
            scheduleMuteTimer(tabId, remaining);
            await addLog(`Recovered mute for tab ${tabId} (${Math.ceil(remaining / 1000)}s left)`);
        }
    }
}

// Release all active mutes (called when user disables the extension)
async function releaseAllMutes() {
    if (keepaliveInterval !== null) {
        clearInterval(keepaliveInterval);
        keepaliveInterval = null;
    }
    for (const [, timer] of muteTimers) clearTimeout(timer);
    muteTimers.clear();

    const tabs = await chrome.tabs.query({ url: "*://*.hotstar.com/*" });
    for (const tab of tabs) {
        if (tab.mutedInfo?.muted) chrome.tabs.update(tab.id, { muted: false });
        chrome.tabs.sendMessage(tab.id, { type: "STOP_WATCHING" }).catch(() => {});
        chrome.storage.local.remove(muteKey(tab.id));
    }
    await addLog("Extension disabled — released all mutes 🔊");
}

// React to enable/disable toggle from popup
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !("enabled" in changes)) return;
    const enabled = changes.enabled.newValue !== false;
    updateIcon(enabled);
    if (!enabled) releaseAllMutes();
});

// --- Daily log cleaner at 2 AM ---

function scheduleDailyLogClean() {
    chrome.alarms.get("clearLogs", (alarm) => {
        if (alarm) return;
        const now = new Date();
        const next2AM = new Date(now);
        next2AM.setHours(2, 0, 0, 0);
        if (next2AM <= now) next2AM.setDate(next2AM.getDate() + 1);
        chrome.alarms.create("clearLogs", {
            when: next2AM.getTime(),
            periodInMinutes: 1440
        });
    });
}

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "clearLogs") {
        chrome.storage.local.set({ swLogs: [] });
        addLog("Logs cleared (daily cleanup 2 AM) 🧹");
    }
});

// Startup
isEnabled().then(updateIcon);
recoverMutes();
scheduleDailyLogClean();
addLog("Hotstar Ad Muter loaded ✅");

// Clear logs on extension reload (chrome://extensions → Reload button)
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ swLogs: [] });
});

chrome.runtime.onMessage.addListener((msg, sender) => {
    if (msg.type === "AD_ENDED_EARLY" && sender.tab?.id) {
        const tabId = sender.tab.id;
        const timer = muteTimers.get(tabId);
        if (timer) clearTimeout(timer);
        addLog("Content resumed — unmuting early").then(() => unmuteTab(tabId, "content"));
    }
});

chrome.webRequest.onBeforeRequest.addListener(
    async (details) => {
        if (!await isEnabled()) return;

        const url = new URL(details.url);
        const adName = url.searchParams.get("adName");
        if (!adName) return;

        let durationSec = 15;
        for (const regex of durationRegexes) {
            const match = adName.match(regex);
            if (match) {
                durationSec = parseInt(match[1], 10);
                break;
            }
        }

        const muteMs = (durationSec * 1000) + 1000;
        const muteUntil = Date.now() + muteMs;

        const tabs = await chrome.tabs.query({ url: "*://*.hotstar.com/*" });
        for (const tab of tabs) {
            chrome.tabs.update(tab.id, { muted: true });
            chrome.tabs.sendMessage(tab.id, { type: "WATCH_FOR_AD_END" }).catch(() => {});

            const isExtension = muteTimers.has(tab.id);
            await addLog(`Ad detected: ${adName}`);
            await addLog(isExtension
                ? `Extended mute for next ad (${durationSec}s)...`
                : `Muting for up to ${durationSec}s...`
            );

            await saveMuteDeadline(tab.id, muteUntil);
            scheduleMuteTimer(tab.id, muteMs);
        }
    },
    { urls: ["*://bifrost-api.hotstar.com/v1/events/track/ct_impression*"] }
);
