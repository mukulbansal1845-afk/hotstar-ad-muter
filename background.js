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

// Release all active mutes (called when user disables the extension)
async function releaseAllMutes() {
    for (const [, timer] of muteTimers) clearTimeout(timer);
    muteTimers.clear();

    const tabs = await chrome.tabs.query({ url: "*://*.hotstar.com/*" });
    for (const tab of tabs) {
        if (tab.mutedInfo?.muted) {
            chrome.tabs.update(tab.id, { muted: false });
        }
        chrome.tabs.sendMessage(tab.id, { type: "STOP_WATCHING" }).catch(() => {});
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

// Set correct icon on service-worker startup
isEnabled().then(updateIcon);

addLog("Hotstar Ad Muter loaded ✅");

async function unmuteTab(tabId, reason = "timer") {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (tab && tab.mutedInfo.muted) {
        chrome.tabs.update(tabId, { muted: false });
        await addLog(reason === "content" ? "Content resumed — unmuted ✅" : "Ad time elapsed — unmuted ✅");
    }
    chrome.tabs.sendMessage(tabId, { type: "STOP_WATCHING" }).catch(() => {});
    muteTimers.delete(tabId);
}

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

        const tabs = await chrome.tabs.query({ url: "*://*.hotstar.com/*" });
        for (const tab of tabs) {
            chrome.tabs.update(tab.id, { muted: true });
            chrome.tabs.sendMessage(tab.id, { type: "WATCH_FOR_AD_END" }).catch(() => {});

            const existing = muteTimers.get(tab.id);
            if (existing) clearTimeout(existing);
            await addLog(`Ad detected: ${adName}`);
            if (existing) {
                await addLog(`Extended mute for next ad (${durationSec}s)...`);
            } else {
                await addLog(`Muting for up to ${durationSec}s...`);
            }

            const timer = setTimeout(() => unmuteTab(tab.id, "timer"), (durationSec * 1000) + 1000);
            muteTimers.set(tab.id, timer);
        }
    },
    { urls: ["*://bifrost-api.hotstar.com/v1/events/track/ct_impression*"] }
);
