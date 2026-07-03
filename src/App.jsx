import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from 'react-qr-code';
import './App.css';

const CLOUD_NAME = 'imnabpzv';
const UPLOAD_PRESET = 'music-upload';

// Анимационные варианты для framer-motion
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.2 } }
};

const stagger = {
  animate: { transition: { staggerChildren: 0.1 } }
};

const cardHover = {
  whileHover: { scale: 1.02, boxShadow: '0 10px 25px rgba(108, 99, 255, 0.3)' },
  whileTap: { scale: 0.98 }
};

function App() {
  const [file, setFile] = useState(null);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const audioRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Загрузка истории
  useEffect(() => {
    const saved = localStorage.getItem('musicHistory');
    if (saved) {
      const parsed = JSON.parse(saved);
      setHistory(parsed);
      if (parsed.length > 0) setCurrentTrack(parsed[0]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('musicHistory', JSON.stringify(history));
  }, [history]);

  // Сброс при смене трека
  useEffect(() => {
    if (!currentTrack) return;
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    if (audioRef.current) audioRef.current.load();
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    audioContextRef.current = null;
    analyserRef.current = null;
  }, [currentTrack]);

  // Визуализатор с аудиоконтекстом
  const setupAudioContext = useCallback(() => {
    if (!audioRef.current || !canvasRef.current) return;
    if (!audioContextRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const source = ctx.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      audioContextRef.current = ctx;
      analyserRef.current = analyser;
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  }, []);

  const drawVisualizer = useCallback(() => {
    if (!analyserRef.current || !canvasRef.current) return;
    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, '#6c63ff');
        gradient.addColorStop(1, '#a855f7');
        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };
    draw();
  }, []);

  useEffect(() => {
    if (isPlaying) {
      setupAudioContext();
      drawVisualizer();
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, setupAudioContext, drawVisualizer]);

  // Управление воспроизведением
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };

  const handleSeek = (e) => {
    const seekTime = (e.target.value / 100) * duration;
    if (audioRef.current) {
      audioRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
    }
  };

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Загрузка файла
  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected && selected.type === 'audio/mpeg') {
      setFile(selected);
    } else {
      alert('Выберите MP3-файл');
      e.target.value = '';
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', UPLOAD_PRESET);
      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Ошибка загрузки');
      const data = await response.json();
      const newTrack = {
        id: Date.now(),
        name: file.name,
        url: data.secure_url,
        date: new Date().toLocaleString(),
      };
      setHistory(prev => [newTrack, ...prev]);
      setCurrentTrack(newTrack);
    } catch (error) {
      alert('Не удалось загрузить трек');
    } finally {
      setLoading(false);
      setFile(null);
    }
  };

  const selectTrack = (track) => setCurrentTrack(track);

  const downloadQR = () => {
    const svg = document.querySelector('.qr-wrapper svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const imgUrl = URL.createObjectURL(svgBlob);
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const link = document.createElement('a');
      link.download = `QR_${currentTrack?.name || 'track'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      URL.revokeObjectURL(imgUrl);
    };
    img.src = imgUrl;
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clearHistory = () => {
    if (window.confirm('Удалить историю?')) {
      setHistory([]);
      setCurrentTrack(null);
    }
  };

  const generateCoverGradient = (name) => {
    if (!name) return 'linear-gradient(135deg, #2d2d4a, #1e1e3a)';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue1 = hash % 360;
    const hue2 = (hue1 + 40) % 360;
    return `linear-gradient(135deg, hsl(${hue1}, 50%, 30%), hsl(${hue2}, 60%, 20%))`;
  };

  return (
    <div className="app">
      {/* Фоновые живые круги */}
      <div className="bg-animation">
        <div className="circle circle1"></div>
        <div className="circle circle2"></div>
        <div className="circle circle3"></div>
      </div>

      <motion.div className="main-layout" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
        {/* Сайдбар */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <span className="logo-icon">🎧</span>
            <h2 className="logo-text">QR Музыка</h2>
          </div>
          <div className="upload-area">
            <label htmlFor="fileInput" className="upload-label">
              {file ? file.name : 'Выберите MP3 файл'}
            </label>
            <input type="file" accept=".mp3" onChange={handleFileChange} id="fileInput" hidden />
            <motion.button
              className="upload-btn-side"
              onClick={handleUpload}
              disabled={!file || loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {loading ? (
                <div className="skeleton-loader" style={{ width: '80px', height: '16px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)' }} />
              ) : (
                'Загрузить'
              )}
            </motion.button>
          </div>
          <div className="playlist">
            <div className="playlist-header">
              <h3>📁 Недавние треки</h3>
              {history.length > 0 && (
                <button className="clear-btn" onClick={clearHistory}>Очистить</button>
              )}
            </div>
            <motion.ul className="playlist-items" variants={stagger} initial="initial" animate="animate">
              <AnimatePresence>
                {history.map(track => (
                  <motion.li
                    key={track.id}
                    variants={fadeInUp}
                    exit={{ opacity: 0, x: -20 }}
                    className={`playlist-item ${currentTrack?.id === track.id ? 'active' : ''}`}
                    onClick={() => selectTrack(track)}
                    whileHover={{ x: 4, backgroundColor: 'rgba(255,255,255,0.03)' }}
                    transition={{ type: 'spring', stiffness: 300 }}
                  >
                    <div className="item-cover" style={{ background: generateCoverGradient(track.name) }}></div>
                    <div className="item-info">
                      <span className="item-name">{track.name}</span>
                      <span className="item-date">{track.date}</span>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
              {history.length === 0 && (
                <p className="empty-playlist">Загрузите первый трек</p>
              )}
            </motion.ul>
          </div>
        </aside>

        {/* Главный контент */}
        <main className="main-content">
          <AnimatePresence mode="wait">
            {currentTrack ? (
              <motion.div
                key={currentTrack.id}
                className="player-card"
                variants={fadeInUp}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.4 }}
              >
                <div className="cover-section">
                  <motion.div
                    className="cover-art"
                    style={{ background: generateCoverGradient(currentTrack.name) }}
                    whileHover={{ scale: 1.05, boxShadow: '0 20px 40px rgba(108, 99, 255, 0.4)' }}
                    transition={{ type: 'spring', stiffness: 300 }}
                  >
                    <span className="cover-text">{currentTrack.name.charAt(0).toUpperCase()}</span>
                  </motion.div>
                  <div className="visualizer-container">
                    <canvas ref={canvasRef} className="visualizer" width="300" height="60"></canvas>
                  </div>
                </div>

                <div className="track-details">
                  <motion.h2 className="track-title" layout>{currentTrack.name}</motion.h2>
                  <div className="track-actions">
                    <motion.button
                      className="action-btn"
                      onClick={() => copyToClipboard(currentTrack.url)}
                      whileHover={{ scale: 1.03, backgroundColor: 'rgba(255,255,255,0.08)' }}
                      whileTap={{ scale: 0.97 }}
                    >
                      {copied ? '✅ Ссылка скопирована' : '📋 Копировать ссылку'}
                    </motion.button>
                  </div>

                  <div className="player-controls">
                    <div className="progress-area">
                      <span className="time">{formatTime(currentTime)}</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={duration ? (currentTime / duration) * 100 : 0}
                        onChange={handleSeek}
                        className="progress-bar"
                      />
                      <span className="time">{formatTime(duration)}</span>
                    </div>
                    <motion.button
                      className="play-btn-main"
                      onClick={togglePlay}
                      whileHover={{ scale: 1.05, boxShadow: '0 0 20px rgba(108, 99, 255, 0.6)' }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {isPlaying ? '⏸️ Пауза' : '▶️ Играть'}
                    </motion.button>
                  </div>

                  <div className="qr-section">
                    <div className="qr-wrapper">
                      <QRCode value={currentTrack.url} size={140} bgColor="#1e1e2f" fgColor="#ffffff" />
                    </div>
                    <motion.button className="btn-outline" onClick={downloadQR} whileHover={{ scale: 1.03, borderColor: '#6c63ff' }} whileTap={{ scale: 0.97 }}>
                      ⬇️ Скачать QR
                    </motion.button>
                  </div>

                  <audio
                    ref={audioRef}
                    src={currentTrack.url}
                    crossOrigin="anonymous"
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onEnded={() => setIsPlaying(false)}
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div className="empty-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="empty-icon">🎵</div>
                <h2>Выберите трек из плейлиста или загрузите новый</h2>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </motion.div>
    </div>
  );
}

export default App;