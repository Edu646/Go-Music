import React, { createContext, useRef, useState, useContext, useEffect } from "react";
import './PlayerContext.css';

const PlayerContext = createContext();

export function PlayerProvider({ children }) {
  const audioRef = useRef(null);
  const progressRef = useRef(null);
  const seekingRef = useRef(false);

  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const hideTimerRef = useRef(null);

  // Estado para la barra de progreso
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

  const play = (song) => {
    // 1. Establecemos la canción en el estado
    setCurrentSong(song);
    setIsPlaying(true);
    setShowPlayer(true);
    clearHideTimer();

    // 2. Forzamos la carga inmediata en el elemento de audio
    setTimeout(() => {
      try {
        if (audioRef.current && song) {
          // --- CORRECCIÓN AQUÍ ---
          // Usamos song.audio directamente. 
          // El componente que llama a play() (SearchPlayer) ya debe encargarse de la URL completa.
          audioRef.current.src = song.audio; 
          
          audioRef.current.load();
          
          const playPromise = audioRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch((error) => {
              console.log("Autoplay prevenido por el navegador o error de carga:", error);
              setIsPlaying(false); // Revertir estado si falla
            });
          }
        }
      } catch (e) {
        console.error("Audio play error:", e);
      }
    }, 0);
  };

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

  // Actualizar tiempo y duración desde el elemento audio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      if (!seekingRef.current) setCurrentTime(audio.currentTime);
    };
    const onLoaded = () => setDuration(audio.duration || 0);
    const onPlay = () => { setIsPlaying(true); setShowPlayer(true); clearHideTimer(); };
    const onPause = () => { setIsPlaying(false); startHideTimer(); };
    const onEnded = () => { setIsPlaying(false); startHideTimer(); };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    // Importante: capturar error de carga
    audio.addEventListener("error", (e) => console.error("Error cargando audio:", audio.error));

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", () => {});
    };
  }, [currentSong]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const formatTime = (t) => {
    if (!t || isNaN(t)) return "0:00";
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60).toString().padStart(2, "0");
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

  return (
    <PlayerContext.Provider value={{ currentSong, play, pause, resume, isPlaying }}>
      {children}

      <div className={`audio-player ${showPlayer ? "" : "hidden"}`} role="region" aria-label="Audio player">
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
            style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
          />
        </div>

        <div className="time-info">
          <span className="time-current">{formatTime(currentTime)}</span>
          <span className="time-divider"> / </span>
          <span className="time-duration">{formatTime(duration)}</span>
        </div>

        <div className="controls">
          {!isPlaying ? (
            <button onClick={resume} title="Reproducir">Play</button>
          ) : (
            <button onClick={pause} title="Pausar">Pause</button>
          )}
        </div>

        {/* --- CORRECCIÓN AQUÍ --- */}
        {/* Quitamos localhost y usamos currentSong.audio directamente */}
        {/* crossOrigin="anonymous" ayuda si tienes problemas de CORS con el audio */}
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