import { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import './App.css';

const CLOUD_NAME = 'imnabpzv';
const UPLOAD_PRESET = 'music-upload';

function App() {
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [copied, setCopied] = useState(false);

  // Аудиоплеер
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const qrRef = useRef(null); // реф на QR-код для скачивания

  useEffect(() => {
    const saved = localStorage.getItem('musicHistory');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('musicHistory', JSON.stringify(history));
  }, [history]);

  // Обработчики аудио
  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
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
      const url = data.secure_url;
      setFileUrl(url);
      setFileName(file.name);
      setHistory(prev => [{ id: Date.now(), name: file.name, url, date: new Date().toLocaleString() }, ...prev]);
      // Сброс плеера
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    } catch (error) {
      alert('Не удалось загрузить трек');
    } finally {
      setLoading(false);
      setFile(null);
    }
  };

  // Скачивание QR с использованием рефа
  const downloadQR = () => {
    const svgElement = qrRef.current?.querySelector('svg');
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
      link.download = `QR_${fileName || 'track'}.png`;
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
    if (window.confirm('Удалить историю?')) setHistory([]);
  };

  return (
    <div className="app">
      <div className="main-container">
        {/* Header */}
        <header className="header">
          <div className="logo">
            <span className="logo-icon">🎧</span>
            <span className="logo-text">QR Музыка</span>
          </div>
          <div className="header-accent">
            <span className="wave-icon">〰️</span>
          </div>
        </header>

        {/* Upload section */}
        <section className="upload-section">
          <div className="upload-card">
            <h2>Загрузи трек</h2>
            <p className="upload-desc">Поддерживается MP3, до 10 МБ</p>
            <div className="file-area">
              <input type="file" accept=".mp3" onChange={handleFileChange} id="fileInput" />
              <label htmlFor="fileInput" className="file-label">
                {file ? file.name : 'Нажми или перетащи файл'}
              </label>
            </div>
            <button className="upload-btn" onClick={handleUpload} disabled={!file || loading}>
              {loading ? <span className="spinner"></span> : '🚀 Загрузить'}
            </button>
          </div>
        </section>

        {/* Result */}
        {fileUrl && (
          <section className="result-section">
            <div className="result-card">
              <div className="result-grid">
                <div className="qr-box" ref={qrRef}>
                  <QRCode value={fileUrl} size={160} bgColor="#1e1e2f" fgColor="#ffffff" />
                  <button className="btn-outline" onClick={downloadQR}>
                    ⬇️ Скачать QR
                  </button>
                </div>
                <div className="track-box">
                  <h3>{fileName}</h3>
                  <div className="link-copy">
                    <input type="text" value={fileUrl} readOnly />
                    <button onClick={() => copyToClipboard(fileUrl)}>{copied ? '✅' : '📋'}</button>
                  </div>

                  {/* Кастомный плеер */}
                  <div className="custom-player">
                    <audio
                      ref={audioRef}
                      src={fileUrl}
                      onTimeUpdate={handleTimeUpdate}
                      onLoadedMetadata={handleLoadedMetadata}
                      onEnded={() => setIsPlaying(false)}
                    />
                    <button className="play-btn" onClick={togglePlay}>
                      {isPlaying ? '⏸️' : '▶️'}
                    </button>
                    <div className="progress-container">
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
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* History */}
        {history.length > 0 && (
          <section className="history-section">
            <div className="history-header">
              <h3>📁 Недавние треки</h3>
              <button className="btn-clear" onClick={clearHistory}>Очистить</button>
            </div>
            <div className="history-grid">
              {history.map(item => (
                <div key={item.id} className="history-card">
                  <div className="history-card-info">
                    <span className="track-name">{item.name}</span>
                    <span className="track-date">{item.date}</span>
                  </div>
                  <div className="history-card-actions">
                    <button onClick={() => copyToClipboard(item.url)} title="Копировать ссылку">📋</button>
                    <a href={item.url} target="_blank" rel="noopener noreferrer" title="Открыть">▶️</a>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="footer">
          <p>Сделано с ❤️ для творческих людей</p>
        </footer>
      </div>
    </div>
  );
}

export default App;