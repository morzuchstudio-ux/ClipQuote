import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Scissors } from 'lucide-react';
import { youtubeAPI } from './youtube-api';
import { seconds, time, roundTime } from './data';
import VideoThumbnail from './VideoThumbnail';

export default function ClipEditor({ videoId, start, end, onChange, onDuration }) {
  const mount = useRef(null), player = useRef(null), preview = useRef(false);
  const [ready, setReady] = useState(false), [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0), [duration, setDuration] = useState(0);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [previewing, setPreviewing] = useState(false), [attempt, setAttempt] = useState(0);
  const a = seconds(start), b = seconds(end);
  const max = duration > 0 ? Math.min(86400, Math.floor(duration * 10) / 10) : 86400;
  const valid = Number.isFinite(a) && Number.isFinite(b) && a >= 0 && b > a && b <= max;
  const latest = useRef({});
  latest.current = { a, b, onDuration };
  useEffect(() => {
    if (!videoId) return;
    let cancelled = false, instance, timer, timeout;
    setReady(false); setError(''); setDuration(0); setPosition(0); setPlaying(false);
    preview.current = false; setPreviewing(false); setNotice('');
    function fail(message) {
      if (cancelled) return;
      clearTimeout(timeout); clearInterval(timer);
      setError(message); setReady(false); setPlaying(false);
      preview.current = false; setPreviewing(false);
    }
    youtubeAPI().then(YT => {
      if (cancelled) return;
      const node = document.createElement('div');
      mount.current.replaceChildren(node);
      timeout = setTimeout(() => fail('The video is taking too long to load.'), 20000);
      instance = new YT.Player(node, {
        host: 'https://www.youtube-nocookie.com', videoId,
        playerVars: { controls: 1, playsinline: 1, rel: 0, origin: location.origin, start: 0 },
        events: {
          onReady: () => {
            if (cancelled) return;
            clearTimeout(timeout); setReady(true);
            timer = setInterval(() => {
              if (cancelled) return;
              const total = instance.getDuration();
              if (Number.isFinite(total) && total > 0) {
                setDuration(total); latest.current.onDuration(total);
              }
              const current = instance.getCurrentTime();
              if (!Number.isFinite(current)) return;
              setPosition(current);
              if (preview.current && instance.getPlayerState() === 1) {
                if (current >= latest.current.b) {
                  instance.pauseVideo(); preview.current = false; setPreviewing(false);
                  setNotice('Preview finished. Adjust the selection or save your clip.');
                } else if (current < latest.current.a - 0.2) instance.seekTo(latest.current.a, true);
              }
            }, 50);
          },
          onStateChange: ({ data }) => {
            if (cancelled) return;
            setPlaying(data === 1);
            if (data === 0 && preview.current) {
              preview.current = false; setPreviewing(false);
              setNotice('Preview finished. Adjust the selection or save your clip.');
            }
          },
          onError: () => fail('YouTube cannot play this video here. It may be restricted or unavailable.'),
          onAutoplayBlocked: () => { if (!cancelled) setNotice('Press Play in the video to continue.'); },
        },
      });
      player.current = instance;
    }).catch(e => fail(e.message));
    return () => {
      cancelled = true; clearInterval(timer); clearTimeout(timeout);
      instance?.destroy(); player.current = null;
    };
  }, [videoId, attempt]);
  function stopPreview() {
    if (preview.current && player.current && ready) {
      player.current.pauseVideo();
      // Seeking clears YouTube's previous endSeconds limit.
      player.current.seekTo(player.current.getCurrentTime(), true);
    }
    preview.current = false; setPreviewing(false); setNotice('');
  }
  function change(nextStart, nextEnd) {
    stopPreview(); onChange(nextStart, nextEnd);
  }
  function skip(amount) {
    const p = player.current;
    if (!ready || error || !p) return;
    const wasPlaying = p.getPlayerState() === 1;
    const target = Math.max(0, Math.min(max, roundTime(p.getCurrentTime() + amount)));
    stopPreview();
    if (!wasPlaying) p.pauseVideo();
    p.seekTo(target, true);
    setPosition(target);
    if (wasPlaying) p.playVideo();
  }
  function mark(which) {
    const current = Math.min(max, roundTime(player.current.getCurrentTime()));
    if (which === 'start') {
      if (current >= max) return setNotice('Choose a start before the end of the video.');
      change(time(current), b > current ? end : '');
    } else {
      if (current <= (Number.isFinite(a) ? a : 0)) return setNotice('The end must be after the start. Play a little further.');
      change(Number.isFinite(a) ? start : '0:00', time(current));
      player.current.pauseVideo();
    }
  }
  function nudge(which, amount) {
    const value = roundTime((which === 'start' ? a : b) + amount);
    if (!Number.isFinite(value) || value < 0 || value > max ||
      (which === 'start' ? Number.isFinite(b) && value >= b : Number.isFinite(a) && value <= a)) return;
    change(which === 'start' ? time(value) : start, which === 'end' ? time(value) : end);
  }
  const from = Number.isFinite(a) ? Math.max(0, Math.min(a, max - 0.1)) : 0;
  const to = Number.isFinite(b) && b > from ? Math.min(b, max) : Math.min(max, from + 10);
  return <section className="clip-editor" aria-label="Clip editor">
    {videoId && <>
      <div className="player editor-player" hidden={!!error}><div ref={mount} /></div>
      {error ? <div className="editor-fallback" role="alert">
        <VideoThumbnail videoId={videoId} alt="YouTube video thumbnail" />
        <p>{error} You can still enter the times below and save the clip.</p>
        <a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer">Open on YouTube ↗</a>
        <button type="button" className="secondary" onClick={() => setAttempt(n => n + 1)}>Retry video</button>
      </div> : <div className="editor-watch">
        <button type="button" className="secondary" disabled={!ready} aria-label={playing ? 'Pause video' : 'Play video'} onClick={() => {
          if (playing) player.current.pauseVideo();
          else { stopPreview(); player.current.seekTo(player.current.getCurrentTime(), true); player.current.playVideo(); }
        }}>{playing ? <Pause size={16} /> : <Play size={16} />} {playing ? 'Pause' : 'Watch video'}</button>
        <output aria-label="Video time">{time(roundTime(position))} / {duration ? time(roundTime(duration)) : '—'}</output>
        {!ready && <span role="status">Loading video…</span>}
      </div>}
    </>}
    <fieldset disabled={!videoId} className="editor-fields">
      {videoId && <div className="editor-jumps" role="group" aria-label="Skip through video">
        {[{label:'Backward', sign:-1, amounts:[5,3,1,0.5]}, {label:'Forward', sign:1, amounts:[0.5,1,3,5]}].map(({label, sign, amounts}) =>
          <div key={label}><span>{label}</span><div className="editor-jump-buttons">
            {amounts.map(amount => <button key={amount} type="button" className="secondary" disabled={!ready || !!error}
              aria-label={`Skip ${label.toLowerCase()} ${amount} seconds`} onClick={() => skip(sign * amount)}>
              {sign < 0 ? '−' : '+'}{amount}s
            </button>)}
          </div></div>)}
      </div>}

      <p className="field-hint">Watch the video, then mark your start and end. You can also type exact times.</p>
      <div className="editor-endpoints">
        {['start', 'end'].map(which => <div className="editor-endpoint" key={which}>
          <label>{which === 'start' ? 'Start' : 'End'}<input required placeholder={which === 'start' ? '0:00' : '0:10'} value={which === 'start' ? start : end} onChange={e => change(which === 'start' ? e.target.value : start, which === 'end' ? e.target.value : end)} /></label>
          <button type="button" className="secondary" disabled={!ready || !!error} onClick={() => mark(which)}>Set {which} here</button>
          <div className="editor-nudge">
            {[-0.1, 0.1].map(amount => <button key={amount} type="button" className="secondary" disabled={!Number.isFinite(which === 'start' ? a : b)} aria-label={`${which === 'start' ? 'Start' : 'End'} ${amount < 0 ? 'earlier' : 'later'} by 0.1 seconds`} onClick={() => nudge(which, amount)}>{amount < 0 ? '−' : '+'}0.1s</button>)}
          </div>
        </div>)}
      </div>
      {duration > 0 && max >= 0.1 && <>
        <div className="dual-range" style={{'--from':`${from / max * 100}%`, '--to':`${to / max * 100}%`}}>
          <div className="range-rail" /><div className="range-selection" />
          <input type="range" aria-label="Range start" aria-valuetext={time(from)} min="0" max={max} step="0.1" value={from} onChange={e => change(time(Math.max(0, roundTime(Math.min(Number(e.target.value), to - 0.1)))), time(to))} />
          <input type="range" aria-label="Range end" aria-valuetext={time(to)} min="0" max={max} step="0.1" value={to} onChange={e => change(time(from), time(Math.min(max, roundTime(Math.max(Number(e.target.value), from + 0.1)))))} />
        </div>
        <div className="range-ticks"><span>0:00</span><span>Drag the handles · arrow keys adjust 0.1s</span><span>{time(max)}</span></div>
      </>}
      <div className="editor-preview">
        <button type="button" className="primary" disabled={!ready || !!error || !valid} onClick={() => {
          preview.current = true; setPreviewing(true); setNotice('Playing your selection…');
          player.current.loadVideoById({videoId, startSeconds:a, endSeconds:b});
        }}><Scissors size={16} /> {previewing ? 'Replay selection' : 'Preview selection'}</button>
        <span>{valid ? `${time(a)} – ${time(b)} · ${roundTime(b - a)}s` : 'Choose a start and end'}</span>
      </div>
      <p className="field-hint">Times accept mm:ss or seconds, including decimals (e.g. 0:08.3).</p>
      {Number.isFinite(b) && b > max && <p className="form-error" role="alert">The end exceeds the video length ({time(max)}).</p>}
      {notice && <p className="field-hint" role="status">{notice}</p>}
    </fieldset>
  </section>;
}
