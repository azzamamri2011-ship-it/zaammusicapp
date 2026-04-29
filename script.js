/**
 * ZaamMusic Logic Engine v1.8.0
 * Author: Zaam Developer
 * Deskripsi: Engine pemutar musik streaming dengan perbaikan PWA Lifecycle & Media Session.
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
        this.registerServiceWorker(); // Pendaftaran SW yang lebih kuat
        console.log("Zaam Engine v1.8.0 Initialized.");
    },

    // --- PERBAIKAN REGISTRASI SW ---
    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                // Pastikan file sw.js ada di root folder yang sama dengan index.html
                navigator.serviceWorker.register('./sw.js')
                    .then(reg => {
                        console.log('SW terdaftar:', reg.scope);
                        // Memaksa update jika ada perubahan pada sw.js
                        reg.update();
                    })
                    .catch(err => console.log('SW Gagal:', err));
            });
        }
    },

    // --- PERBAIKAN PWA INSTALLATION SYSTEM ---
    initPWA() {
        // Event ini hanya akan muncul jika SW aktif dan koneksi HTTPS aman
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log("Browser mendukung instalasi PWA!");
            e.preventDefault();
            this.deferredPrompt = e;
            
            // Opsional: Langsung ganti teks tombol jika sudah siap diinstal
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
                    console.log(`User response: ${outcome}`);
                    if (outcome === 'accepted') {
                        this.showToast("Instalasi dimulai...");
                    }
                    this.deferredPrompt = null;
                } else {
                    // Pesan ini muncul jika SW belum 'Active' atau masih di HTTP
                    this.showToast("Sistem belum siap. Pastikan menggunakan HTTPS dan tunggu 5 detik.");
                }
            });
        }

        window.addEventListener('appinstalled', () => {
            this.showToast("ZaamMusic berhasil terpasang di perangkat!");
            this.deferredPrompt = null;
        });
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

    // --- DATABASE CORE ---
    saveToLibrary(song) {
        const exists = this.myLibrary.some(item => item.title === song.title);
        if (exists) { this.showToast("Lagu sudah ada!"); return; }
        this.myLibrary.push(song);
        this.syncStorage();
        this.showToast("Tersimpan ke Koleksi.");
        this.updateLibraryUI();
    },

    removeFromLibrary(index, e) {
        e.stopPropagation();
        if(confirm("Hapus lagu ini?")) {
            this.myLibrary.splice(index, 1);
            this.syncStorage();
            this.updateLibraryUI();
            this.showToast("Dihapus.");
        }
    },

    clearAllDatabase() {
        if (this.myLibrary.length === 0) return;
        if (confirm("Hapus seluruh koleksi?")) {
            this.myLibrary = [];
            this.syncStorage();
            this.updateLibraryUI();
            this.showToast("Database bersih.");
        }
    },

    syncStorage() {
        localStorage.setItem('zaam_library', JSON.stringify(this.myLibrary));
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

    updateLibraryUI() {
        const list = document.getElementById('playlist-items');
        if(!list) return;
        document.getElementById('lib-count').innerText = `${this.myLibrary.length} lagu`;
        list.innerHTML = '';
        if(this.myLibrary.length === 0) {
            list.innerHTML = `<p style="text-align:center;color:gray;padding:20px;">Kosong</p>`;
            return;
        }
        this.myLibrary.forEach((song, index) => {
            const item = document.createElement('div');
            item.className = 'song-item';
            item.innerHTML = `<img src="${song.thumbnail}" class="song-thumb">
                <div class="song-meta"><div class="song-name">${song.title}</div></div>
                <button class="btn-add"><i class="fas fa-trash"></i></button>`;
            item.onclick = () => { this.playSource = 'library'; this.currentIndex = index; this.playTrack(song); };
            item.querySelector('.btn-add').onclick = (e) => this.removeFromLibrary(index, e);
            list.appendChild(item);
        });
    },

    // --- PLAYER & MEDIA SESSION (UNTUK NEXT/PREV DI LATAR BELAKANG) ---
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
        
        // KRUSIAL: Media Session agar tombol di notifikasi bekerja
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: song.title,
                artist: song.author,
                artwork: [{ src: song.thumbnail, sizes: '512x512', type: 'image/png' }]
            });

            // Handler tombol di latar belakang / lockscreen
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
        
        console.log("Zaam Engine Event Listeners: All systems online. PWA logic reinforced.");
    }
};

document.addEventListener('DOMContentLoaded', () => logic.init());
