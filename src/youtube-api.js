let apiPromise;
export function youtubeAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise)
    apiPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      const timer = setTimeout(() => {
        apiPromise = null;
        reject(
          new Error(
            "YouTube is not responding. Retry or open the original video below.",
          ),
        );
      }, 15000);
      window.onYouTubeIframeAPIReady = () => {
        clearTimeout(timer);
        previous?.();
        resolve(window.YT);
      };
      let script = document.querySelector("script[data-youtube-api]");
      if (!script) {
        script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.dataset.youtubeApi = "true";
        document.head.append(script);
      }
      script.onerror = () => {
        clearTimeout(timer);
        script.remove();
        apiPromise = null;
        reject(new Error("Could not load YouTube. Check your connection."));
      };
    });
  return apiPromise;
}
