/**
 * ZAAMMUSIC ENGINE v2.0
 * Fitur: Local Storage, Auto-Next, Particle System, Modern Fetch
 */

const logic = {
    myLibrary: JSON.parse(localStorage.getItem('zaam_library')) || [],
    currentIndex: -1,
    isDragging: false,
    playSource: 'search', // 'search' atau 'library'

    init() {
        this.setupEventListeners();
        this.updateLibraryUI();
        this.initVisuals();
        console.log("ZaamMusic Core Ready.");
    },

    // --- NAVIGATION ---
    navigate(pageId, element) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        
        document.getElementById(pageId).classList.add('active');
        element.classList.add('active');
        
        if (pageId === 'library-page') this.updateLibraryUI();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    showToast(text) {
        const t = document.getElementById('toast-msg');
        t.innerText = text;
        t.style.display = 'block';
        setTimeout(() => { t.style.display = 'none'; }, 2500);
    },

    // --- DATA MANAGEMENT ---
    saveToLibrary(song) {
        const isExist = this.myLibrary.some(item => item.title === song.title);
        if (isExist) {
            this.showToast("Lagu sudah ada di Library!");
            return;
        }
        this.myLibrary.push(song);
        this.updateStorage();
        this.showToast("Berhasil disimpan ke Library");
    },

    removeFromLibrary(index, event) {
        event.stopPropagation();
        this.myLibrary.splice(index, 1);
        this.updateStorage();
        this.updateLibraryUI();
        this.showToast("Lagu dihapus dari Library");
    },

    updateStorage() {
        localStorage.setItem('zaam_library', JSON.stringify(this.myLibrary));
        document.getElementById('lib-count').innerText = `${this.myLibrary.length} Lagu`;
    },

    // --- SEARCH SYSTEM ---
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
                this.showToast("Lagu tidak ditemukan");
            }
        } catch (error) {
            loader.style.display = 'none';
            this.showToast("Terjadi kesalahan jaringan");
        }
    },

    // --- RENDERING ---
    renderSearchItem(song) {
        const list = document.getElementById('results-list');
        const div = document.createElement('div');
        div.className = 'song-item';
        div.innerHTML = `
            <img src="${song.thumbnail}" class="song-thumb">
            <div class="song-meta">
                <div class="song-name">${song.title}</div>
                <div class="song-sub">${song.author}</div>
            </div>
            <button class="btn-action"><i class="fas fa-plus-circle"></i></button>
        `;
        div.onclick = () => {
            this.playSource = 'search';
            this.playTrack(song);
        };
        div.querySelector('button').onclick = (e) => {
            e.stopPropagation();
            this.saveToLibrary(song);
        };
        list.appendChild(div);
    },

    updateLibraryUI() {
        const list = document.getElementById('playlist-items');
        const countLabel = document.getElementById('lib-count');
        
        countLabel.innerText = `${this.myLibrary.length} Lagu`;
        list.innerHTML = this.myLibrary.length === 0 ? 
            '<p style="color:gray; text-align:center; padding:50px;">Library kosong. Cari lagu dan tambahkan!</p>' : '';

        this.myLibrary.forEach((song, index) => {
            const div = document.createElement('div');
            div.className = 'song-item';
            div.innerHTML = `
                <img src="${song.thumbnail}" class="song-thumb">
                <div class="song-meta">
                    <div class="song-name">${song.title}</div>
                    <div class="song-sub">${song.author}</div>
                </div>
                <button class="btn-action" style="color: var(--accent)"><i class="fas fa-trash-alt"></i></button>
            `;
            div.onclick = () => {
                this.playSource = 'library';
                this.currentIndex = index;
                this.playTrack(song);
            };
            div.querySelector('button').onclick = (e) => this.removeFromLibrary(index, e);
            list.appendChild(div);
        });
    },

    // --- PLAYER CORE ---
    playTrack(song) {
        const audio = document.getElementById('audio-engine');
        const player = document.getElementById('master-player');
        
        player.style.display = 'flex';
        document.getElementById('track-thumb').src = song.thumbnail;
        document.getElementById('track-name').innerText = song.title;
        document.getElementById('track-artist').innerText = song.author;

        audio.src = song.mp3;
        audio.play().catch(() => this.showToast("Klik tombol Play untuk memutar"));
    },

    handleAutoNext() {
        if (this.playSource === 'library' && this.currentIndex < this.myLibrary.length - 1) {
            this.currentIndex++;
            this.playTrack(this.myLibrary[this.currentIndex]);
            this.showToast("Memutar lagu berikutnya...");
        }
    },

    formatTime(seconds) {
        if (isNaN(seconds)) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    },

    // --- EVENT BINDING ---
    setupEventListeners() {
        const audio = document.getElementById('audio-engine');
        const searchInput = document.getElementById('search-input');
        const playBtn = document.getElementById('play-toggle');
        const slider = document.getElementById('progress-slider');

        searchInput.onkeypress = (e) => { if (e.key === 'Enter') this.performSearch(); };

        playBtn.onclick = () => {
            if (audio.paused) audio.play();
            else audio.pause();
        };

        audio.onplay = () => { playBtn.innerHTML = '<i class="fas fa-pause-circle"></i>'; };
        audio.onpause = () => { playBtn.innerHTML = '<i class="fas fa-play-circle"></i>'; };

        audio.ontimeupdate = () => {
            if (!this.isDragging && audio.duration) {
                const prog = (audio.currentTime / audio.duration) * 100;
                slider.value = Math.floor(audio.currentTime);
                slider.max = Math.floor(audio.duration);
                document.getElementById('time-now').innerText = this.formatTime(audio.currentTime);
                document.getElementById('time-total').innerText = this.formatTime(audio.duration);
            }
        };

        audio.onended = () => this.handleAutoNext();

        slider.oninput = () => { this.isDragging = true; };
        slider.onchange = () => {
            audio.currentTime = slider.value;
            this.isDragging = false;
        };
    },

    initVisuals() {
        const canvas = document.getElementById('canvas-bg');
        const ctx = canvas.getContext('2d');
        let particles = [];

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.onresize = resize; resize();

        for(let i=0; i<60; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                size: Math.random() * 1.5,
                spX: (Math.random() - 0.5) * 0.3,
                spY: (Math.random() - 0.5) * 0.3
            });
        }

        const animate = () => {
            ctx.clearRect(0,0, canvas.width, canvas.height);
            ctx.fillStyle = 'rgba(0, 255, 136, 0.2)';
            particles.forEach(p => {
                p.x += p.spX; p.y += p.spY;
                if(p.x < 0 || p.x > canvas.width) p.spX *= -1;
                if(p.y < 0 || p.y > canvas.height) p.spY *= -1;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
                ctx.fill();
            });
            requestAnimationFrame(animate);
        };
        animate();
    }
};

document.addEventListener('DOMContentLoaded', () => logic.init());
