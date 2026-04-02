const durationRegexes = [
    /_VCTA_(\d{1,3})/i,
    /(\d{1,3})s(?:Eng(?:lish)?|Hin(?:di)?)/i,
    /(?:HIN|ENG|HINDI|ENGLISH)_\D*(\d{1,3})/i
];

console.log("Hotstar Ad Muter loaded ✅");

const muteTimers = new Map();

function unmuteTab(tabId) {
    chrome.tabs.get(tabId, (tab) => {
        if (tab && tab.mutedInfo.muted) {
            chrome.tabs.update(tabId, { muted: false });
            console.log("Unmuted ✅");
        }
    });
    chrome.tabs.sendMessage(tabId, { type: "STOP_WATCHING" }).catch(() => {});
    muteTimers.delete(tabId);
}

chrome.runtime.onMessage.addListener((msg, sender) => {
    if (msg.type === "AD_ENDED_EARLY" && sender.tab?.id) {
        console.log("Ad ended early — unmuting immediately");
        const timer = muteTimers.get(sender.tab.id);
        if (timer) clearTimeout(timer);
        unmuteTab(sender.tab.id);
    }
});

chrome.webRequest.onBeforeRequest.addListener(
    async (details) => {
        const url = new URL(details.url);
        const adName = url.searchParams.get("adName");
        if (!adName) return;

        console.log("Ad detected:", adName);

        let durationSec = 15;
        for (const regex of durationRegexes) {
            const match = adName.match(regex);
            if (match) {
                durationSec = parseInt(match[1], 10);
                break;
            }
        }

        console.log(`Muting for up to ${durationSec} seconds...`);

        const tabs = await chrome.tabs.query({ url: "*://*.hotstar.com/*" });
        for (const tab of tabs) {
            // Always mute regardless of current mute state
            chrome.tabs.update(tab.id, { muted: true });

            // Tell content script to watch for early ad end
            chrome.tabs.sendMessage(tab.id, { type: "WATCH_FOR_AD_END" }).catch(() => {});

            // Cancel existing timer and reset — extends mute across back-to-back ads
            const existing = muteTimers.get(tab.id);
            if (existing) {
                clearTimeout(existing);
                console.log("Extended mute for next ad...");
            }

            const timer = setTimeout(() => unmuteTab(tab.id), (durationSec * 1000) + 1000);
            muteTimers.set(tab.id, timer);
        }
    },
    { urls: ["*://bifrost-api.hotstar.com/v1/events/track/ct_impression*"] }
);