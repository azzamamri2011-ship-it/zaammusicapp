/**
 * ZaamMusic Logic Engine v1.8.3 (Updated)
 * Author: Zaam Developer
 * Deskripsi: Engine pemutar musik dengan integrasi UI Full Player & Mini Bar.
 */

const logic = {
    myLibrary: JSON.parse(localStorage.getItem('zaam_favorites')) || [],
    myHistory: JSON.parse(localStorage.getItem('zaam_history')) || [],
    currentIndex: -1,
    isDragging: false,
    playSource: 'search', 
    currentList: [],      
    isRepeat: false,
    deferredPrompt: null,

    init() {
        this.setupEventListeners();
        this.updateLibraryLabels();
        this.initPWA();
        this.registerServiceWorker();
        console.log("Zaam Engine v1.8.3 Initialized.");
    },

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW Gagal:', err));
            });
        }
    },

    initPWA() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            const installBtn = document.getElementById('pwa-install-btn');
            if (installBtn) {
                installBtn.style.display = "block";
            }
        });

        const installBtn = document.getElementById('pwa-install-btn');
        if (installBtn) {
            installBtn.onclick = async () => {
                if (this.deferredPrompt) {
                    this.deferredPrompt.prompt();
                    this.deferredPrompt = null;
                }
            };
        }
    },

    // --- UI NAVIGATION & PLAYER TOGGLE ---
    navigate(pageId, element) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');
        element.classList.add('active');
        if(pageId === 'library-page') this.closeLibraryDetail();
    },

    toggleFullPlayer(show) {
        const player = document.getElementById('full-player');
        if (show) {
            player.classList.add('active');
        } else {
            player.classList.remove('active');
        }
    },

    // --- SEARCH ENGINE ---
    async performSearch() {
        const query = document.getElementById('search-input').value.trim();
        if (!query) return;

        const loader = document.getElementById('search-loading');
        const list = document.getElementById('results-list');
        
        loader.style.display = 'block';
        list.innerHTML = '';

        try {
            const response = await fetch(`https://api.danzy.web.id/api/search/yts?q=${encodeURIComponent(query)}`);
            const data = await response.json();
            
            loader.style.display = 'none';

            if (data.status && data.result) {
                this.currentList = data.result;
                this.playSource = 'search';
                data.result.forEach((song, index) => {
                    this.renderSearchItem(song, index);
                });
            } else {
                list.innerHTML = '<p style="text-align:center;color:gray;margin-top:20px;">Lagu tidak ditemukan.</p>';
            }
        } catch (err) {
            loader.style.display = 'none';
            this.showToast("Koneksi API Gagal.");
        }
    },

    renderSearchItem(song, index) {
        const list = document.getElementById('results-list');
        const item = document.createElement('div');
        item.className = 'song-item';
        item.innerHTML = `
            <img src="${song.thumbnail}" class="song-thumb">
            <div class="song-meta">
                <div class="song-name">${song.title}</div>
                <div class="song-sub">${song.duration}</div>
            </div>
            <button class="btn-add"><i class="fas fa-plus-circle"></i></button>`;
        
        item.onclick = () => { 
            this.currentIndex = index;
            this.playTrack(song); 
        };
        
        item.querySelector('.btn-add').onclick = (e) => { 
            e.stopPropagation(); 
            this.saveToLibrary(song); 
        };
        list.appendChild(item);
    },

    // --- PLAYER CORE ---
    async playTrack(song) {
        const audio = document.getElementById('audio-engine');
        const masterPlayer = document.getElementById('master-player');
        
        // MUNCULKAN MINI PLAYER (Penting!)
        masterPlayer.style.display = 'block';
        
        // Update UI Mini & Full Player
        document.getElementById('track-thumb').src = song.thumbnail;
        document.getElementById('track-name').innerText = song.title;
        document.getElementById('track-artist').innerText = song.author?.name || "Zaam Music";
        
        document.getElementById('full-track-thumb').src = song.thumbnail;
        document.getElementById('full-track-name').innerText = song.title;
        document.getElementById('full-track-artist').innerText = song.author?.name || "Streaming";

        const audioUrl = `https://api-faa.my.id/faa/ytplay?query=${encodeURIComponent(song.url)}`; 
        
        try {
            this.showToast("Memuat lagu...");
            const res = await fetch(audioUrl);
            const audioData = await res.json();
            
            if(audioData.result && audioData.result.mp3) {
                audio.src = audioData.result.mp3;
                audio.play();
                this.addToHistory(song);
            } else {
                this.showToast("Gagal mengambil audio.");
            }
        } catch (e) {
            this.showToast("Error Koneksi.");
        }

        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: song.title,
                artist: song.author?.name,
                artwork: [{ src: song.thumbnail, sizes: '512x512', type: 'image/png' }]
            });
        }
    },

    // --- CONTROLS ---
    togglePlay() {
        const audio = document.getElementById('audio-engine');
        if (audio.src) {
            audio.paused ? audio.play() : audio.pause();
        }
    },

    nextTrack() {
        let list = (this.playSource === 'favorites') ? this.myLibrary : (this.playSource === 'history' ? this.myHistory : this.currentList);
        if (list.length > 0) {
            this.currentIndex = (this.currentIndex + 1) % list.length;
            this.playTrack(list[this.currentIndex]);
        }
    },

    prevTrack() {
        let list = (this.playSource === 'favorites') ? this.myLibrary : (this.playSource === 'history' ? this.myHistory : this.currentList);
        if (list.length > 0) {
            this.currentIndex = (this.currentIndex - 1 + list.length) % list.length;
            this.playTrack(list[this.currentIndex]);
        }
    },

    toggleRepeat() {
        this.isRepeat = !this.isRepeat;
        const btn = document.getElementById('repeat-btn');
        btn.style.color = this.isRepeat ? 'var(--spotify-green)' : 'white';
        this.showToast(this.isRepeat ? "Repeat On" : "Repeat Off");
    },

    // --- DATABASE OPS ---
    saveToLibrary(song) {
        const exists = this.myLibrary.some(item => item.url === song.url);
        if (exists) { this.showToast("Sudah ada di favorit!"); return; }
        this.myLibrary.unshift(song);
        this.syncStorage();
        this.showToast("Ditambah ke Favorit.");
        this.updateLibraryLabels();
    },

    addToHistory(song) {
        this.myHistory = this.myHistory.filter(item => item.url !== song.url);
        this.myHistory.unshift(song);
        if (this.myHistory.length > 50) this.myHistory.pop();
        this.syncStorage();
        this.updateLibraryLabels();
    },

    clearAllDatabase() {
        if(confirm("Hapus seluruh history dan lagu favorit?")) {
            localStorage.clear();
            location.reload();
        }
    },

    syncStorage() {
        localStorage.setItem('zaam_favorites', JSON.stringify(this.myLibrary));
        localStorage.setItem('zaam_history', JSON.stringify(this.myHistory));
    },

    updateLibraryLabels() {
        const f = document.getElementById('fav-count-label');
        const h = document.getElementById('hist-count-label');
        if(f) f.innerText = `${this.myLibrary.length} lagu`;
        if(h) h.innerText = `${this.myHistory.length} lagu`;
    },

    // --- LIBRARY VIEW ---
    renderLibraryCategory(type) {
        const hub = document.getElementById('library-hub');
        const detail = document.getElementById('library-detail-view');
        const list = document.getElementById('playlist-items');
        
        hub.style.display = 'none';
        detail.style.display = 'block';
        list.innerHTML = '';
        
        let source = (type === 'favorites') ? this.myLibrary : this.myHistory;
        document.getElementById('library-title-text').innerText = (type === 'favorites') ? 'Koleksi Favorit' : 'Riwayat Putar';

        source.forEach((song, index) => {
            const item = document.createElement('div');
            item.className = 'song-item';
            item.innerHTML = `
                <img src="${song.thumbnail}" class="song-thumb">
                <div class="song-meta">
                    <div class="song-name">${song.title}</div>
                    <div class="song-sub">${song.duration}</div>
                </div>
                <button class="btn-add"><i class="fas fa-trash"></i></button>`;
            
            item.onclick = () => { 
                this.playSource = type; 
                this.currentIndex = index; 
                this.playTrack(song); 
            };
            
            item.querySelector('.btn-add').onclick = (e) => {
                e.stopPropagation();
                source.splice(index, 1);
                this.syncStorage();
                this.renderLibraryCategory(type);
            };
            list.appendChild(item);
        });
    },

    closeLibraryDetail() {
        document.getElementById('library-hub').style.display = 'block';
        document.getElementById('library-detail-view').style.display = 'none';
        this.updateLibraryLabels();
    },

    showToast(text) {
        const t = document.getElementById('toast-msg');
        if(!t) return;
        t.innerText = text;
        t.style.display = 'block';
        setTimeout(() => { t.style.display = 'none'; }, 2500);
    },

    setupEventListeners() {
        const audio = document.getElementById('audio-engine');
        const slider = document.getElementById('full-progress-slider');
        
        document.getElementById('search-input').onkeypress = (e) => { if (e.key === 'Enter') this.performSearch(); };
        
        audio.ontimeupdate = () => {
            if (!this.isDragging && audio.duration) {
                const prog = (audio.currentTime / audio.duration) * 100;
                document.getElementById('mini-progress-fill').style.width = prog + "%";
                slider.value = audio.currentTime;
                slider.max = audio.duration;

                // Update teks waktu di Full Player
                const formatTime = (s) => {
                    let m = Math.floor(s / 60);
                    let sec = Math.floor(s % 60);
                    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
                };
                document.getElementById('full-time-now').innerText = formatTime(audio.currentTime);
                document.getElementById('full-time-total').innerText = formatTime(audio.duration);
            }
        };

        audio.onplay = () => {
            document.getElementById('play-toggle').className = 'fas fa-pause';
            document.getElementById('play-toggle-full').innerHTML = '<i class="fas fa-pause-circle"></i>';
        };

        audio.onpause = () => {
            document.getElementById('play-toggle').className = 'fas fa-play';
            document.getElementById('play-toggle-full').innerHTML = '<i class="fas fa-play-circle"></i>';
        };

        audio.onended = () => {
            if (this.isRepeat) {
                audio.currentTime = 0;
                audio.play();
            } else {
                this.nextTrack();
            }
        };

        slider.oninput = () => { this.isDragging = true; };
        slider.onchange = () => { audio.currentTime = slider.value; this.isDragging = false; };
    }
};

document.addEventListener('DOMContentLoaded', () => logic.init());
