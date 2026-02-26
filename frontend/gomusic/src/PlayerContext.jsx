import React, {
  createContext,
  useRef,
  useState,
  useContext,
  useEffect,
  useCallback,
} from "react";
import "./PlayerContext.css";

const PlayerContext = createContext();

export function PlayerProvider({ children }) {
  const audioRef = useRef(null);
  const progressRef = useRef(null);
  const seekingRef = useRef(false);

  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const hideTimerRef = useRef(null);

  // ✅ Cola + índice
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(-1);

  // Barra de progreso
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const startHideTimer = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setShowPlayer(false);
    }, 6000);
  };

  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  /**
   * ✅ play(song, list, index)
   * - Si list NO viene (null/undefined) -> modo single: queue = [song], queueIndex = 0
   * - Si list viene array -> queue=list, queueIndex=index (si es número)
   */
  const play = useCallback((song, list = null, index = null) => {
    if (!song) return;

    setCurrentSong(song);
    setIsPlaying(true);
    setShowPlayer(true);
    clearHideTimer();

    // ✅ MUY IMPORTANTE: si NO me pasas lista, reseteo cola a SOLO esa canción
    if (Array.isArray(list)) {
      setQueue(list);
      setQueueIndex(typeof index === "number" ? index : 0);
    } else {
      setQueue([song]);
      setQueueIndex(0);
    }

    setTimeout(() => {
      try {
        const audio = audioRef.current;
        if (!audio) return;

        audio.src = song.audio;
        audio.load();

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.log("Autoplay prevenido o error de carga:", error);
            setIsPlaying(false);
          });
        }
      } catch (e) {
        console.error("Audio play error:", e);
      }
    }, 0);
  }, []);

  const pause = () => {
    audioRef.current?.pause();
    setIsPlaying(false);
    startHideTimer();
  };

  const resume = () => {
    if (!currentSong) return;
    audioRef.current?.play();
    setIsPlaying(true);
    clearHideTimer();
    setShowPlayer(true);
  };

  // ✅ NEXT / PREV: si queue <= 1 -> NO HACER NADA
  const next = useCallback(() => {
    if (!Array.isArray(queue) || queue.length <= 1) return;

    const idx =
      queueIndex >= 0
        ? queueIndex
        : queue.findIndex((s) => String(s?._id) === String(currentSong?._id));

    const nextIndex = idx < 0 ? 0 : (idx + 1) % queue.length;

    setQueueIndex(nextIndex);
    const nextSong = queue[nextIndex];
    if (nextSong) play(nextSong, queue, nextIndex);
  }, [queue, queueIndex, currentSong, play]);

  const prev = useCallback(() => {
    if (!Array.isArray(queue) || queue.length <= 1) return;

    const idx =
      queueIndex >= 0
        ? queueIndex
        : queue.findIndex((s) => String(s?._id) === String(currentSong?._id));

    const prevIndex = idx < 0 ? 0 : (idx - 1 + queue.length) % queue.length;

    setQueueIndex(prevIndex);
    const prevSong = queue[prevIndex];
    if (prevSong) play(prevSong, queue, prevIndex);
  }, [queue, queueIndex, currentSong, play]);

  // Eventos del audio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      if (!seekingRef.current) setCurrentTime(audio.currentTime);
    };
    const onLoaded = () => setDuration(audio.duration || 0);

    const onPlay = () => {
      setIsPlaying(true);
      setShowPlayer(true);
      clearHideTimer();
    };

    const onPause = () => {
      setIsPlaying(false);
      startHideTimer();
    };

    // ✅ cuando acaba:
    // - si queue > 1 -> siguiente
    // - si queue <= 1 -> parar y ocultar
    const onEnded = () => {
      if (Array.isArray(queue) && queue.length > 1) {
        next();
      } else {
        setIsPlaying(false);
        startHideTimer();
      }
    };

    const onError = () => console.error("Error cargando audio:", audio.error);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [queue, next]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const formatTime = (t) => {
    if (!t || isNaN(t)) return "0:00";
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  };

  const updateSeekFromClientX = (clientX) => {
    const wrap = progressRef.current;
    if (!wrap || !duration) return;
    const rect = wrap.getBoundingClientRect();
    const x = clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    const seekTime = ratio * duration;

    if (audioRef.current) {
      audioRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
    }
  };

  const handlePointerDown = (e) => {
    seekingRef.current = true;
    if (e.pointerType === "touch") e.preventDefault?.();
    updateSeekFromClientX(e.clientX);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const handlePointerMove = (e) => {
    if (!seekingRef.current) return;
    updateSeekFromClientX(e.clientX);
  };

  const handlePointerUp = (e) => {
    if (!seekingRef.current) return;
    updateSeekFromClientX(e.clientX);
    seekingRef.current = false;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  };

  // ✅ Solo habilitar flechas si hay más de 1 canción en cola
  const hasQueue = Array.isArray(queue) && queue.length > 1;

  return (
    <PlayerContext.Provider
      value={{
        currentSong,
        play,
        pause,
        resume,
        isPlaying,
        next,
        prev,
      }}
    >
      {children}

      <div
        className={`audio-player ${showPlayer ? "" : "hidden"}`}
        role="region"
        aria-label="Audio player"
      >
        <div className="song-info">
          {currentSong ? (
            <>
              <div className="song-title">{currentSong.name}</div>
              <div className="song-artist">{currentSong.artist}</div>
            </>
          ) : (
            <div className="song-title">Sin canción</div>
          )}
        </div>

        <div
          className="progress-wrap"
          ref={progressRef}
          onPointerDown={handlePointerDown}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={duration || 0}
          aria-valuenow={currentTime}
          tabIndex={0}
          title="Barra de progreso"
        >
          <div
            className="progress-bar"
            style={{
              width: `${duration ? (currentTime / duration) * 100 : 0}%`,
            }}
          />
        </div>

        <div className="time-info">
          <span className="time-current">{formatTime(currentTime)}</span>
          <span className="time-divider"> / </span>
          <span className="time-duration">{formatTime(duration)}</span>
        </div>

        <div className="controls">
          <button onClick={prev} title="Anterior" disabled={!hasQueue}>
            ◀
          </button>

          {!isPlaying ? (
            <button onClick={resume} title="Reproducir">
              Play
            </button>
          ) : (
            <button onClick={pause} title="Pausar">
              Pause
            </button>
          )}

          <button onClick={next} title="Siguiente" disabled={!hasQueue}>
            ▶
          </button>
        </div>

        <audio
          ref={audioRef}
          src={currentSong ? currentSong.audio : ""}
          preload="auto"
          crossOrigin="anonymous"
          style={{ display: "none" }}
        />
      </div>
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  return useContext(PlayerContext);
}
