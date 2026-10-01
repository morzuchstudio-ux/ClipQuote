import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Repeat, Volume2, VolumeX } from "lucide-react";
import { time, roundTime } from "./data";
import { youtubeAPI } from "./youtube-api";
export default function ClipPlayer({ clip, onPlaybackStatus }) {
  const statusCallback = useRef(onPlaybackStatus);
  statusCallback.current = onPlaybackStatus;
  const mount = useRef(),
    playerRef = useRef(),
    loopRef = useRef(false),
    finished = useRef(false);
  const [ready, setReady] = useState(false),
    [playing, setPlaying] = useState(false),
    [position, setPosition] = useState(0),
    [loop, setLoop] = useState(false),
    [muted, setMuted] = useState(false),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  const duration = Math.round((clip.end - clip.start) * 1000) / 1000;
  useEffect(() => {
    if (error) statusCallback.current?.("failed");
  }, [error]);
  useEffect(() => {
    let cancelled = false,
      player,
      timer,
      readyTimeout;
    statusCallback.current?.("pending");
    setReady(false);
    setPlaying(false);
    setPosition(0);
    setError("");
    setMuted(false);
    finished.current = false;
    const range = {
      videoId: clip.videoId,
      startSeconds: clip.start,
      endSeconds: clip.end,
    };
    function finish() {
      if (finished.current) return;
      finished.current = true;
      if (loopRef.current) {
        finished.current = false;
        setPosition(0);
        player.loadVideoById(range);
      } else {
        player.pauseVideo();
        setPlaying(false);
        setPosition(duration);
      }
    }
    youtubeAPI()
      .then((YT) => {
        if (cancelled) return;
        const node = document.createElement("div");
        mount.current.replaceChildren(node);
        readyTimeout = setTimeout(() => {
          if (!cancelled)
            setError(
              "The player is not responding. Try again or open the video on YouTube.",
            );
        }, 20000);
        player = new YT.Player(node, {
          host: "https://www.youtube-nocookie.com",
          videoId: clip.videoId,
          playerVars: {
            controls: 0,
            autoplay: 0,
            disablekb: 1,
            playsinline: 1,
            rel: 0,
            origin: location.origin,
            start: Math.floor(clip.start),
            end: Math.ceil(clip.end),
          },
          events: {
            onReady: () => {
              if (cancelled) return;
              clearTimeout(readyTimeout);
              setError("");
              setReady(true);
              player.cueVideoById(range);
              timer = setInterval(() => {
                if (cancelled || finished.current) return;
                const current = player.getCurrentTime();
                const state = player.getPlayerState();
                if (state === 1) {
                  if (current >= clip.end) {
                    finish();
                    return;
                  }
                  if (current < clip.start - 0.2) {
                    player.seekTo(clip.start, true);
                    return;
                  }
                }
                setPosition(
                  Math.max(0, Math.min(duration, current - clip.start)),
                );
              }, 50);
            },
            onStateChange: (event) => {
              if (cancelled) return;
              if (event.data === 1 && finished.current) {
                finished.current = false;
                setPosition(0);
                player.loadVideoById(range);
                return;
              }
              setPlaying(event.data === 1);
              if (event.data === 0) finish();
              if (event.data === 1) {
                statusCallback.current?.("passed");
                const total = player.getDuration();
                if (total > 0 && clip.end > total + 0.5) {
                  player.pauseVideo();
                  setError(
                    "The selected range exceeds the video length. Add a clip with a valid range.",
                  );
                }
              }
            },
            onError: (event) => {
              if (!cancelled) {
                clearTimeout(readyTimeout);
                clearInterval(timer);
                setPlaying(false);
                setError(
                  event.data === 100
                    ? "This video is unavailable. It may be private or removed."
                    : "YouTube could not play this video here. It may be age-restricted or have embedding disabled.",
                );
              }
            },
            onAutoplayBlocked: () => {
              if (!cancelled) setPlaying(false);
            },
          },
        });
        playerRef.current = player;
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
      clearInterval(timer);
      clearTimeout(readyTimeout);
      playerRef.current = null;
      player?.destroy();
    };
  }, [clip.videoId, clip.start, clip.end, attempt]);
  function replay() {
    finished.current = false;
    setPosition(0);
    playerRef.current.loadVideoById({
      videoId: clip.videoId,
      startSeconds: clip.start,
      endSeconds: clip.end,
    });
  }
  function toggle() {
    if (playing) {
      playerRef.current.pauseVideo();
    } else if (finished.current || position >= duration) {
      replay();
    } else {
      playerRef.current.playVideo();
    }
  }
  return (
    <div className="clip-player">
      <div className="player" hidden={!!error}>
        <div ref={mount} />
      </div>
      {error ? (
        <div className="playback-fallback" role="alert">
          <h3>Watch this one on YouTube</h3>
          <p>{error}</p>
          <a className="primary" href={`https://www.youtube.com/watch?v=${clip.videoId}&t=${Math.floor(clip.start)}s`} target="_blank" rel="noopener noreferrer">Watch on YouTube ↗</a>
          <p className="field-hint">Opens near {time(Math.floor(clip.start))}. The selected end time cannot be enforced on YouTube. You may need to sign in there.</p>
          <button type="button" className="secondary" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
        </div>
      ) : <div className="clip-controls">
        <div className="clip-control-heading">
          <span>SELECTED CLIP</span>
          <span>{duration} s</span>
        </div>
        <input
          className="clip-timeline"
          type="range"
          min="0"
          max={duration}
          step="0.1"
          value={position}
          disabled={!ready || !!error}
          aria-label="Clip position"
          aria-valuetext={`${time(roundTime(position))} of ${time(duration)}`}
          style={{ "--progress": `${(position / duration) * 100}%` }}
          onChange={(e) => {
            const next = Number(e.target.value);
            setPosition(next);
            finished.current = next >= duration;
            const p = playerRef.current;
            if (next >= duration) {
              p.pauseVideo();
              p.seekTo(Math.max(clip.start, clip.end - 0.05), true);
              setPlaying(false);
            } else {
              p.seekTo(clip.start + next, true);
            }
          }}
        />
        <div className="clip-control-row">
          <button
            type="button"
            className="primary clip-play"
            disabled={!ready || !!error}
            onClick={toggle}
            aria-label={playing ? "Pause" : "Play clip"}
          >
            {playing ? <Pause size={17} /> : <Play size={17} />}
          </button>
          <button
            type="button"
            className="icon-button"
            disabled={!ready || !!error}
            onClick={replay}
            aria-label="Replay clip"
          >
            <RotateCcw size={18} />
          </button>
          <output className="clip-clock" aria-label="Clip time">
            {time(roundTime(position))} <span>/ {time(duration)}</span>
          </output>
          <button
            type="button"
            className={loop ? "icon-button control-enabled" : "icon-button"}
            aria-label="Loop clip"
            aria-pressed={loop}
            onClick={() => {
              loopRef.current = !loop;
              setLoop(!loop);
            }}
          >
            <Repeat size={19} />
          </button>
          <button
            type="button"
            className="icon-button"
            disabled={!ready || !!error}
            aria-label={muted ? "Unmute" : "Mute"}
            onClick={() => {
              const p = playerRef.current;
              if (muted) p.unMute();
              else p.mute();
              setMuted(!muted);
            }}
          >
            {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
          </button>
        </div>
        {!ready && !error && (
          <p className="player-status" role="status">
            Loading player…
          </p>
        )}
      </div>}
    </div>
  );
}
