let cleanup = null;

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "WATCH_FOR_AD_END") {
        cleanup?.();
        const video = document.querySelector("video");
        if (!video) return;

        const onAdEnd = () => {
            chrome.runtime.sendMessage({ type: "AD_ENDED_EARLY" });
            stopWatching();
        };

        const observer = new MutationObserver(onAdEnd);
        observer.observe(video, { attributes: true, attributeFilter: ["src"] });
        video.addEventListener("emptied", onAdEnd, { once: true });

        const stopWatching = () => {
            observer.disconnect();
            video.removeEventListener("emptied", onAdEnd);
            cleanup = null;
        };

        cleanup = stopWatching;
    }

    if (msg.type === "STOP_WATCHING") {
        cleanup?.();
    }
});