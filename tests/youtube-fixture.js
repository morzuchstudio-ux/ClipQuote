export async function mockYouTube(page) {
  await page.addInitScript(() => {
    window.YT = {
      Player: class {
        constructor(node, options) {
          this.options = options;
          this.current = options.playerVars.start;
          this.state = 5;
          this.muted = window.testInitialMuted ?? false;
          this.volume = window.testInitialVolume ?? 100;
          this.loads = [];
          this.seeks = [];
          const iframe = document.createElement("iframe");
          iframe.title = "YouTube fixture";
          iframe.src = `https://www.youtube-nocookie.com/embed/${options.videoId}?start=${options.playerVars.start}&end=${options.playerVars.end}&controls=0`;
          node.replaceWith(iframe);
          this.iframe = iframe;
          window.testPlayer = this;
          setTimeout(() => options.events.onReady({ target: this }), 0);
        }
        cueVideoById(range) {
          this.current = range.startSeconds;
          this.range = range;
          this.change(5);
        }
        loadVideoById(range) {
          this.loads.push(range);
          this.range = range;
          this.current = range.startSeconds;
          if (window.testBlockAutoplay) {
            this.change(5);
            this.options.events.onAutoplayBlocked?.();
          } else this.change(1);
        }
        change(state) {
          this.state = state;
          this.options.events.onStateChange({ data: state });
        }
        playVideo() {
          this.change(1);
        }
        pauseVideo() {
          this.change(2);
        }
        getCurrentTime() {
          return this.current;
        }
        getPlayerState() {
          return this.state;
        }
        getDuration() {
          return 1000;
        }
        seekTo(value) {
          this.current = value;
          this.seeks.push(value);
        }
        mute() { this.muted = true; }
        unMute() { this.muted = false; }
        isMuted() { return this.muted; }
        getVolume() { return this.volume; }
        setVolume(value) { this.volume = value; }
        destroy() {
          this.iframe.remove();
          window.testPlayerDestroyed = true;
        }
      },
    };
  });
  await page.route("https://www.youtube-nocookie.com/**", (r) =>
    r.fulfill({ body: "<html>Video fixture</html>", contentType: "text/html" }),
  );
}
