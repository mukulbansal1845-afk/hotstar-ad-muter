const durationRegexes = [
    /_VCTA_(\d{1,3})/i,                            // "VCTA_30" ← most reliable
    /(\d{1,3})s(?:Eng(?:lish)?|Hin(?:di)?)/i,      // "20sEng", "15sHindi"
    /(?:HIN|ENG|HINDI|ENGLISH)_[^\d]*(\d{1,3})/i
];

console.log("Hotstar Ad Muter loaded ✅");

chrome.webRequest.onBeforeRequest.addListener(
    async (details) => {
        const url = new URL(details.url);
        const adName = url.searchParams.get("adName");

        if (!adName) return;

        console.log("Ad detected:", adName);

        // Try to extract ad duration from the adName string
        let durationSec = 15; // default fallback: 15 seconds
        for (const regex of durationRegexes) {
            const match = adName.match(regex);
            if (match) {
                durationSec = parseInt(match[1], 10);
                break;
            }
        }

        console.log(`Muting for ${durationSec} seconds...`);

        // Find the Hotstar tab and mute it
        const tabs = await chrome.tabs.query({ url: "*://*.hotstar.com/*" });
        for (const tab of tabs) {
            if (!tab.mutedInfo.muted) {
                chrome.tabs.update(tab.id, { muted: true });

                // Unmute after ad duration (with small buffer)
                setTimeout(() => {
                    chrome.tabs.get(tab.id, (updatedTab) => {
                        if (updatedTab && updatedTab.mutedInfo.muted) {
                            chrome.tabs.update(tab.id, { muted: false });
                            console.log("Unmuted ✅");
                        }
                    });
                }, (durationSec * 1000) + 1000);
            }
        }
    },
    {
        urls: ["*://bifrost-api.hotstar.com/v1/events/track/ct_impression*"]
    }
);