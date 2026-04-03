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

addLog("Hotstar Ad Muter loaded ✅");

function unmuteTab(tabId) {
    chrome.tabs.get(tabId, (tab) => {
        if (tab && tab.mutedInfo.muted) {
            chrome.tabs.update(tabId, { muted: false });
            addLog("Unmuted ✅");
        }
    });
    chrome.tabs.sendMessage(tabId, { type: "STOP_WATCHING" }).catch(() => {});
    muteTimers.delete(tabId);
}

chrome.runtime.onMessage.addListener((msg, sender) => {
    if (msg.type === "AD_ENDED_EARLY" && sender.tab?.id) {
        addLog("Ad ended early — unmuting immediately");
        const timer = muteTimers.get(sender.tab.id);
        if (timer) clearTimeout(timer);
        unmuteTab(sender.tab.id);
    }
});

chrome.webRequest.onBeforeRequest.addListener(
    async (details) => {
        if (!await isEnabled()) return;

        const url = new URL(details.url);
        const adName = url.searchParams.get("adName");
        if (!adName) return;

        addLog(`Ad detected: ${adName}`);

        let durationSec = 15;
        for (const regex of durationRegexes) {
            const match = adName.match(regex);
            if (match) {
                durationSec = parseInt(match[1], 10);
                break;
            }
        }

        addLog(`Muting for up to ${durationSec}s...`);

        const tabs = await chrome.tabs.query({ url: "*://*.hotstar.com/*" });
        for (const tab of tabs) {
            chrome.tabs.update(tab.id, { muted: true });
            chrome.tabs.sendMessage(tab.id, { type: "WATCH_FOR_AD_END" }).catch(() => {});

            const existing = muteTimers.get(tab.id);
            if (existing) {
                clearTimeout(existing);
                addLog("Extended mute for next ad...");
            }

            const timer = setTimeout(() => unmuteTab(tab.id), (durationSec * 1000) + 1000);
            muteTimers.set(tab.id, timer);
        }
    },
    { urls: ["*://bifrost-api.hotstar.com/v1/events/track/ct_impression*"] }
);
