/**
 * ZaamMusic Logic Engine v1.7.0
 * Author: Zaam Developer
 * Deskripsi: Engine pemutar musik streaming berbasis YT API dengan integrasi PWA Full.
 */

const logic = {
    myLibrary: JSON.parse(localStorage.getItem('zaam_library')) || [],
    currentIndex: -1,
    isDragging: false,
    playSource: 'search',
    isRepeat: false,
    deferredPrompt: null,

    init() {
        this.setupEventListeners();
        this.updateLibraryUI();
        this.initPWA();
        this.registerServiceWorker(); // Langkah krusial untuk Instalasi
        console.log("Zaam Engine v1.7.0 Berhasil Dimuat.");
    },

    // --- FITUR UTAMA: REGISTRASI SERVICE WORKER ---
    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js')
                    .then(reg => console.log('SW terdaftar dengan scope:', reg.scope))
                    .catch(err => console.log('SW gagal didaftarkan:', err));
            });
        }
    },

    // --- PWA INSTALLATION SYSTEM ---
    initPWA() {
        // Event ini hanya terpanggil jika file sw.js ada dan HTTPS aktif
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            console.log("PWA Siap Diinstal");
            this.showToast("ZaamMusic siap diinstal ke layar utama!");
        });

        const installBtn = document.getElementById('pwa-install-btn');
        if (installBtn) {
            installBtn.addEventListener('click', async () => {
                if (this.deferredPrompt) {
                    this.deferredPrompt.prompt();
                    const { outcome } = await this.deferredPrompt.userChoice;
                    if (outcome === 'accepted') {
                        this.showToast("Instalasi berhasil!");
                    }
                    this.deferredPrompt = null;
                } else {
                    // Jika deferredPrompt null, berarti syarat PWA belum terpenuhi
                    this.showToast("Gunakan Chrome & pastikan HTTPS aktif untuk menginstal.");
                }
            });
        }
    },

    // --- UI NAVIGATION ---
    navigate(pageId, element) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        
        document.getElementById(pageId).classList.add('active');
        element.classList.add('active');

        if(pageId === 'library-page') this.updateLibraryUI();
        
        document.querySelector('.app-container').scrollTo({ top: 0, behavior: 'smooth' });
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

    // --- DATABASE & STORAGE CORE ---
    saveToLibrary(song) {
        const exists = this.myLibrary.some(item => item.title === song.title);
        if (exists) {
            this.showToast("Lagu sudah ada di Koleksi!");
            return;
        }
        this.myLibrary.push(song);
        this.syncStorage();
        this.showToast("Tersimpan di Database Lokal.");
        this.updateLibraryUI();
    },

    removeFromLibrary(index, e) {
        e.stopPropagation();
        if(confirm("Hapus lagu ini?")) {
            this.myLibrary.splice(index, 1);
            this.syncStorage();
            this.updateLibraryUI();
            this.showToast("Lagu dihapus.");
        }
    },

    clearAllDatabase() {
        if (this.myLibrary.length === 0) return;
        if (confirm("Hapus semua koleksi lagu?")) {
            this.myLibrary = [];
            this.syncStorage();
            this.updateLibraryUI();
            this.showToast("Database dibersihkan.");
        }
    },

    syncStorage() {
        localStorage.setItem('zaam_library', JSON.stringify(this.myLibrary));
    },

    // --- SEARCH ENGINE (YT API) ---
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

            if (data.status && data.result) {
                this.renderSearchItem(data.result);
            } else {
                this.showToast("Musik tidak ditemukan.");
            }
        } catch (err) {
            loader.style.display = 'none';
            this.showToast("Gagal mengambil data dari server.");
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
            <button class="btn-add"><i class="fas fa-plus-circle"></i></button>
        `;
        item.onclick = () => { 
            this.playSource = 'search'; 
            this.playTrack(song); 
        };
        item.querySelector('.btn-add').onclick = (e) => { 
            e.stopPropagation(); 
            this.saveToLibrary(song); 
        };
        list.appendChild(item);
    },

    updateLibraryUI() {
        const list = document.getElementById('playlist-items');
        const countEl = document.getElementById('lib-count');
        if(!list) return;

        countEl.innerText = `${this.myLibrary.length} lagu tersimpan`;
        list.innerHTML = '';

        if(this.myLibrary.length === 0) {
            list.innerHTML = `<div style="text-align:center; padding:40px; color:gray;"><i class="fas fa-compact-disc fa-spin fa-3x"></i><p>Belum ada koleksi</p></div>`;
            return;
        }

        this.myLibrary.forEach((song, index) => {
            const item = document.createElement('div');
            item.className = 'song-item';
            item.innerHTML = `
                <img src="${song.thumbnail}" class="song-thumb">
                <div class="song-meta">
                    <div class="song-name">${song.title}</div>
                    <div class="song-sub">${song.author}</div>
                </div>
                <button class="btn-add" style="color: #ff4757"><i class="fas fa-minus-circle"></i></button>
            `;
            item.onclick = () => {
                this.playSource = 'library';
                this.currentIndex = index;
                this.playTrack(song);
            };
            item.querySelector('.btn-add').onclick = (e) => this.removeFromLibrary(index, e);
            list.appendChild(item);
        });
    },

    // --- PLAYER CONTROLLER (NEXT/PREV DI LATAR BELAKANG) ---
    playTrack(song) {
        const audio = document.getElementById('audio-engine');
        document.getElementById('master-player').style.display = 'block';

        document.getElementById('track-thumb').src = song.thumbnail;
        document.getElementById('full-track-thumb').src = song.thumbnail;
        document.getElementById('track-name').innerText = song.title;
        document.getElementById('full-track-name').innerText = song.title;
        document.getElementById('track-artist').innerText = song.author;
        document.getElementById('full-track-artist').innerText = song.author;

        audio.src = song.mp3;
        audio.play().catch(() => this.showToast("Gagal memutar trek."));
        
        // Setup tombol kontrol di panel notifikasi (Layar Kunci)
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
        if (this.playSource === 'library' && this.myLibrary.length > 0) {
            this.currentIndex = (this.currentIndex + 1) % this.myLibrary.length;
            this.playTrack(this.myLibrary[this.currentIndex]);
        }
    },

    prevTrack() {
        if (this.playSource === 'library' && this.myLibrary.length > 0) {
            this.currentIndex = (this.currentIndex - 1 + this.myLibrary.length) % this.myLibrary.length;
            this.playTrack(this.myLibrary[this.currentIndex]);
        }
    },

    toggleRepeat() {
        this.isRepeat = !this.isRepeat;
        document.getElementById('repeat-btn').style.color = this.isRepeat ? '#1DB954' : 'white';
        this.showToast(this.isRepeat ? "Mode Ulang Aktif" : "Mode Ulang Mati");
    },

    formatTime(s) {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec < 10 ? '0' : ''}${sec}`;
    },

    setupEventListeners() {
        const audio = document.getElementById('audio-engine');
        const slider = document.getElementById('full-progress-slider');

        document.getElementById('search-input').onkeypress = (e) => { 
            if (e.key === 'Enter') this.performSearch(); 
        };

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
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "playing";
        };

        audio.onpause = () => {
            document.getElementById('play-toggle').className = 'fas fa-play';
            document.getElementById('play-toggle-full').innerHTML = '<i class="fas fa-play-circle"></i>';
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "paused";
        };

        audio.onended = () => { 
            this.isRepeat ? (audio.currentTime = 0, audio.play()) : this.nextTrack(); 
        };

        slider.oninput = () => { this.isDragging = true; };
        slider.onchange = () => { audio.currentTime = slider.value; this.isDragging = false; };
        
        /**
         * Kode ini dirancang untuk ZaamMusic agar memiliki pengalaman PWA premium.
         * Semua fungsi diatur agar tidak terjadi memori bocor di browser seluler.
         * Dukungan untuk MediaSession API memastikan pengguna dapat mengontrol musik 
         * tanpa harus membuka aplikasi di layar utama.
         */
        console.log("Semua listener aktif. Selamat menikmati musik!");
    }
};

document.addEventListener('DOMContentLoaded', () => logic.init());
