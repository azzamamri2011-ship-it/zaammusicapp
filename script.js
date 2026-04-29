/**
 * ZaamMusic Logic Engine v1.8.1 (Enhanced Library Edition)
 * Author: Zaam Developer
 * Deskripsi: Engine pemutar musik streaming dengan pemisahan otomatis History & Favorit.
 */

const logic = {
    // Penambahan database History yang terpisah dari Library (Favorit)
    myLibrary: JSON.parse(localStorage.getItem('zaam_favorites')) || [], // Favorit (Bintang)
    myHistory: JSON.parse(localStorage.getItem('zaam_history')) || [],     // History (Love)
    currentIndex: -1,
    isDragging: false,
    playSource: 'search',
    isRepeat: false,
    deferredPrompt: null,

    init() {
        this.setupEventListeners();
        this.updateLibraryLabels(); // Update jumlah angka di tampilan menu utama
        this.initPWA();
        this.registerServiceWorker();
        console.log("Zaam Engine v1.8.1 Initialized with Auto-History.");
    },

    // --- PERBAIKAN REGISTRASI SW ---
    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js')
                    .then(reg => {
                        console.log('SW terdaftar:', reg.scope);
                        reg.update();
                    })
                    .catch(err => console.log('SW Gagal:', err));
            });
        }
    },

    // --- PERBAIKAN PWA INSTALLATION SYSTEM ---
    initPWA() {
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log("Browser mendukung instalasi PWA!");
            e.preventDefault();
            this.deferredPrompt = e;
            const installBtn = document.getElementById('pwa-install-btn');
            if (installBtn) {
                installBtn.innerHTML = '<i class="fas fa-arrow-alt-circle-down"></i> PASANG ZAAM MUSIC';
                installBtn.style.background = "#1DB954";
                installBtn.style.color = "#000";
            }
        });

        const installBtn = document.getElementById('pwa-install-btn');
        if (installBtn) {
            installBtn.addEventListener('click', async () => {
                if (this.deferredPrompt) {
                    this.deferredPrompt.prompt();
                    const { outcome } = await this.deferredPrompt.userChoice;
                    if (outcome === 'accepted') this.showToast("Instalasi dimulai...");
                    this.deferredPrompt = null;
                } else {
                    this.showToast("Sistem belum siap. Gunakan HTTPS.");
                }
            });
        }

        window.addEventListener('appinstalled', () => {
            this.showToast("ZaamMusic terpasang!");
            this.deferredPrompt = null;
        });
    },

    // --- UI NAVIGATION & CATEGORY SYSTEM ---
    navigate(pageId, element) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');
        element.classList.add('active');
        
        // Jika ke halaman koleksi, pastikan kembali ke menu utama koleksi dulu
        if(pageId === 'library-page') this.closeLibraryDetail();
        document.querySelector('.app-container').scrollTo({ top: 0, behavior: 'smooth' });
    },

    // Merender daftar lagu berdasarkan kategori yang dipilih
    renderLibraryCategory(type) {
        const hub = document.getElementById('library-hub');
        const detail = document.getElementById('library-detail-view');
        const list = document.getElementById('playlist-items');
        const title = document.getElementById('library-title-text');

        if(!hub || !detail) return;

        hub.style.display = 'none';
        detail.style.display = 'block';
        list.innerHTML = '';
        
        let source = (type === 'favorites') ? this.myLibrary : this.myHistory;
        title.innerText = (type === 'favorites') ? 'Lagu Favorit' : 'History Putar';

        if(source.length === 0) {
            list.innerHTML = `<p style="text-align:center;color:gray;padding:40px;">Belum ada lagu di sini.</p>`;
            return;
        }

        source.forEach((song, index) => {
            const item = document.createElement('div');
            item.className = 'song-item';
            item.innerHTML = `
                <img src="${song.thumbnail}" class="song-thumb">
                <div class="song-meta">
                    <div class="song-name">${song.title}</div>
                    <div class="song-sub">${song.author}</div>
                </div>
                <button class="btn-add"><i class="fas fa-trash-alt"></i></button>`;
            
            item.onclick = () => { 
                this.playSource = type; 
                this.currentIndex = index; 
                this.playTrack(song); 
            };
            
            item.querySelector('.btn-add').onclick = (e) => {
                e.stopPropagation();
                this.removeFromSpecificList(type, index);
            };
            list.appendChild(item);
        });
    },

    closeLibraryDetail() {
        const hub = document.getElementById('library-hub');
        const detail = document.getElementById('library-detail-view');
        if(hub && detail) {
            hub.style.display = 'block';
            detail.style.display = 'none';
        }
        this.updateLibraryLabels();
    },

    toggleFullPlayer(show) {
        const fullPlayer = document.getElementById('full-player');
        if (show) fullPlayer.classList.add('active');
        else fullPlayer.classList.remove('active');
    },

    showToast(text) {
        const t = document.getElementById('toast-msg');
        t.innerText = text;
        t.style.display = 'block';
        setTimeout(() => { t.style.display = 'none'; }, 3000);
    },

    // --- DATABASE CORE ---
    saveToLibrary(song) {
        const exists = this.myLibrary.some(item => item.title === song.title);
        if (exists) { this.showToast("Sudah ada di favorit!"); return; }
        this.myLibrary.unshift(song);
        this.syncStorage();
        this.showToast("Disimpan ke Favorit.");
        this.updateLibraryLabels();
    },

    // Menambah ke history (Otomatis saat lagu diputar)
    addToHistory(song) {
        // Hapus duplikat lama agar lagu terbaru naik ke atas
        this.myHistory = this.myHistory.filter(item => item.title !== song.title);
        this.myHistory.unshift(song);
        if (this.myHistory.length > 50) this.myHistory.pop(); // Maksimal 50 histori
        this.syncStorage();
        this.updateLibraryLabels();
    },

    removeFromSpecificList(type, index) {
        if(confirm("Hapus dari daftar ini?")) {
            if(type === 'favorites') this.myLibrary.splice(index, 1);
            else this.myHistory.splice(index, 1);
            this.syncStorage();
            this.renderLibraryCategory(type);
        }
    },

    clearAllDatabase() {
        if (confirm("Hapus seluruh histori dan favorit secara permanen?")) {
            this.myLibrary = [];
            this.myHistory = [];
            this.syncStorage();
            this.closeLibraryDetail();
            this.showToast("Database dibersihkan.");
        }
    },

    syncStorage() {
        localStorage.setItem('zaam_favorites', JSON.stringify(this.myLibrary));
        localStorage.setItem('zaam_history', JSON.stringify(this.myHistory));
    },

    updateLibraryLabels() {
        const favLabel = document.getElementById('fav-count-label');
        const histLabel = document.getElementById('hist-count-label');
        if(favLabel) favLabel.innerText = `${this.myLibrary.length} lagu disimpan`;
        if(histLabel) histLabel.innerText = `${this.myHistory.length} lagu terakhir`;
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
            const response = await fetch(`https://api-faa.my.id/faa/ytplay?query=${encodeURIComponent(query)}`);
            const data = await response.json();
            loader.style.display = 'none';
            if (data.status && data.result) { this.renderSearchItem(data.result); }
        } catch (err) {
            loader.style.display = 'none';
            this.showToast("Gagal memuat hasil.");
        }
    },

    renderSearchItem(song) {
        const list = document.getElementById('results-list');
        const item = document.createElement('div');
        item.className = 'song-item';
        item.innerHTML = `
            <img src="${song.thumbnail}" class="song-thumb">
            <div class="song-meta">
                <div class="song-name">${song.title}</div>
                <div class="song-sub">${song.author}</div>
            </div>
            <button class="btn-add"><i class="fas fa-plus-circle"></i></button>`;
        item.onclick = () => { this.playSource = 'search'; this.playTrack(song); };
        item.querySelector('.btn-add').onclick = (e) => { e.stopPropagation(); this.saveToLibrary(song); };
        list.appendChild(item);
    },

    // --- PLAYER CORE ---
    playTrack(song) {
        const audio = document.getElementById('audio-engine');
        document.getElementById('master-player').style.display = 'block';
        document.getElementById('track-thumb').src = song.thumbnail;
        document.getElementById('track-name').innerText = song.title;
        document.getElementById('track-artist').innerText = song.author;
        document.getElementById('full-track-thumb').src = song.thumbnail;
        document.getElementById('full-track-name').innerText = song.title;
        document.getElementById('full-track-artist').innerText = song.author;

        audio.src = song.mp3;
        audio.play();
        
        // OTOMATIS: Tambahkan ke history setiap kali lagu diputar
        this.addToHistory(song);

        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: song.title,
                artist: song.author,
                artwork: [{ src: song.thumbnail, sizes: '512x512', type: 'image/png' }]
            });
            navigator.mediaSession.setActionHandler('play', () => this.togglePlay());
            navigator.mediaSession.setActionHandler('pause', () => this.togglePlay());
            navigator.mediaSession.setActionHandler('nexttrack', () => this.nextTrack());
            navigator.mediaSession.setActionHandler('previoustrack', () => this.prevTrack());
        }
    },

    togglePlay() {
        const audio = document.getElementById('audio-engine');
        audio.paused ? audio.play() : audio.pause();
    },

    nextTrack() {
        let list = (this.playSource === 'favorites') ? this.myLibrary : this.myHistory;
        if (list.length > 0) {
            this.currentIndex = (this.currentIndex + 1) % list.length;
            this.playTrack(list[this.currentIndex]);
        }
    },

    prevTrack() {
        let list = (this.playSource === 'favorites') ? this.myLibrary : this.myHistory;
        if (list.length > 0) {
            this.currentIndex = (this.currentIndex - 1 + list.length) % list.length;
            this.playTrack(list[this.currentIndex]);
        }
    },

    toggleRepeat() {
        this.isRepeat = !this.isRepeat;
        document.getElementById('repeat-btn').style.color = this.isRepeat ? '#1DB954' : 'white';
        this.showToast(this.isRepeat ? "Repeat Aktif" : "Repeat Mati");
    },

    formatTime(s) {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec < 10 ? '0' : ''}${sec}`;
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
                document.getElementById('full-time-now').innerText = this.formatTime(audio.currentTime);
                document.getElementById('full-time-total').innerText = this.formatTime(audio.duration);
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

        audio.onended = () => { this.isRepeat ? (audio.currentTime = 0, audio.play()) : this.nextTrack(); };
        slider.oninput = () => { this.isDragging = true; };
        slider.onchange = () => { audio.currentTime = slider.value; this.isDragging = false; };
        
        console.log("Zaam Engine Event Listeners: All systems online. History & Favorites syncing.");
    }
};

document.addEventListener('DOMContentLoaded', () => logic.init());
