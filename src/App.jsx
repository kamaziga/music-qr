import { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'react-qr-code';
import './App.css';

const CLOUD_NAME = 'imnabpzv';
const UPLOAD_PRESET = 'music-upload';

function App() {
  const [file, setFile] = useState(null);
  const [currentTrack, setCurrentTrack] = useState(null); // { id, name, url, date }
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

  // Загрузка истории из localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('musicHistory');
    if (savedHistory) {
      const parsed = JSON.parse(savedHistory);
      setHistory(parsed);
      if (parsed.length > 0) {
        setCurrentTrack(parsed[0]); // Автоматически выбираем последний загруженный
      }
    }
  }, []);

  // Сохранение истории при изменении
  useEffect(() => {
    localStorage.setItem('musicHistory', JSON.stringify(history));
  }, [history]);

  // Инициализация аудиоконтекста и анализатора при смене трека
  useEffect(() => {
    if (!currentTrack) return;
    // Сбрасываем состояния
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    if (audioRef.current) {
      audioRef.current.load();
    }
    // Закрываем старый контекст
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    audioContextRef.current = null;
    analyserRef.current = null;
  }, [currentTrack]);

  // Настройка визуализатора после взаимодействия
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

  // Анимация визуализатора
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

  // Запуск/остановка визуализации
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

  // Обработчики аудио
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
      setHistory((prev) => [newTrack, ...prev]);
      setCurrentTrack(newTrack);
    } catch (error) {
      alert('Не удалось загрузить трек');
    } finally {
      setLoading(false);
      setFile(null);
    }
  };

  const selectTrack = (track) => {
    setCurrentTrack(track);
  };

  const downloadQR = () => {
    const svgElement = document.querySelector('.qr-wrapper svg');
    if (!svgElement) return;
    const svgData = new XMLSerializer().serializeToString(svgElement);
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
      {/* Анимированный фон */}
      <div className="bg-animation">
        <div className="circle circle1"></div>
        <div className="circle circle2"></div>
        <div className="circle circle3"></div>
      </div>

      <div className="main-layout">
        {/* Боковая панель с историей */}
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
            <button className="upload-btn-side" onClick={handleUpload} disabled={!file || loading}>
              {loading ? <span className="spinner"></span> : 'Загрузить'}
            </button>
          </div>
          <div className="playlist">
            <div className="playlist-header">
              <h3>📁 Недавние треки</h3>
              {history.length > 0 && (
                <button className="clear-btn" onClick={clearHistory}>Очистить</button>
              )}
            </div>
            <ul className="playlist-items">
              {history.map((track) => (
                <li
                  key={track.id}
                  className={`playlist-item ${currentTrack?.id === track.id ? 'active' : ''}`}
                  onClick={() => selectTrack(track)}
                >
                  <div className="item-cover" style={{ background: generateCoverGradient(track.name) }}></div>
                  <div className="item-info">
                    <span className="item-name">{track.name}</span>
                    <span className="item-date">{track.date}</span>
                  </div>
                </li>
              ))}
              {history.length === 0 && (
                <p className="empty-playlist">Загрузите первый трек</p>
              )}
            </ul>
          </div>
        </aside>

        {/* Основной контент */}
        <main className="main-content">
          {currentTrack ? (
            <div className="player-card">
              <div className="cover-section">
                <div
                  className="cover-art"
                  style={{ background: generateCoverGradient(currentTrack.name) }}
                >
                  <span className="cover-text">{currentTrack.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="visualizer-container">
                  <canvas ref={canvasRef} className="visualizer" width="300" height="60"></canvas>
                </div>
              </div>

              <div className="track-details">
                <h2 className="track-title">{currentTrack.name}</h2>
                <div className="track-actions">
                  <button className="action-btn" onClick={() => copyToClipboard(currentTrack.url)}>
                    {copied ? '✅ Ссылка скопирована' : '📋 Копировать ссылку'}
                  </button>
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
                  <button className="play-btn-main" onClick={togglePlay}>
                    {isPlaying ? '⏸️ Пауза' : '▶️ Играть'}
                  </button>
                </div>

                <div className="qr-section">
                  <div className="qr-wrapper">
                    <QRCode value={currentTrack.url} size={140} bgColor="#1e1e2f" fgColor="#ffffff" />
                  </div>
                  <button className="btn-outline" onClick={downloadQR}>⬇️ Скачать QR</button>
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
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">🎵</div>
              <h2>Выберите трек из плейлиста или загрузите новый</h2>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;