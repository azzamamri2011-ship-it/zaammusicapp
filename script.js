const logic = {
    myLibrary: JSON.parse(localStorage.getItem('zaam_library')) || [],
    currentIndex: -1,
    isDragging: false,
    playSource: 'search',
    isRepeat: false,

    init() {
        this.setupEventListeners();
        this.updateLibraryUI();
        this.initVisuals();
    },

    // --- NAVIGATION & UI ---
    navigate(pageId, element) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');
        element.classList.add('active');
        if (pageId === 'library-page') this.updateLibraryUI();
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
        setTimeout(() => { t.style.display = 'none'; }, 2500);
    },

    // --- DATA ---
    saveToLibrary(song) {
        if (this.myLibrary.some(item => item.title === song.title)) {
            this.showToast("Lagu sudah ada di Library!");
            return;
        }
        this.myLibrary.push(song);
        this.updateStorage();
        this.showToast("Disimpan ke Library");
    },

    removeFromLibrary(index, event) {
        event.stopPropagation();
        this.myLibrary.splice(index, 1);
        this.updateStorage();
        this.updateLibraryUI();
    },

    updateStorage() {
        localStorage.setItem('zaam_library', JSON.stringify(this.myLibrary));
        document.getElementById('lib-count').innerText = `${this.myLibrary.length} Lagu`;
    },

    // --- SEARCH ---
    async performSearch() {
        const query = document.getElementById('search-input').value.trim();
        if (!query) return;
        const loader = document.getElementById('search-loading');
        const list = document.getElementById('results-list');
        loader.style.display = 'block';
        list.innerHTML = '';
        try {
            const resp = await fetch(`https://api-faa.my.id/faa/ytplay?query=${encodeURIComponent(query)}`);
            const data = await resp.json();
            loader.style.display = 'none';
            if (data.status) this.renderSearchItem(data.result);
        } catch (e) { 
            loader.style.display = 'none';
            this.showToast("Error Koneksi");
        }
    },

    renderSearchItem(song) {
        const list = document.getElementById('results-list');
        const div = document.createElement('div');
        div.className = 'song-item';
        div.innerHTML = `
            <img src="${song.thumbnail}" class="song-thumb">
            <div class="song-meta"><div class="song-name">${song.title}</div><div class="song-sub">${song.author}</div></div>
            <button class="btn-action"><i class="fas fa-plus-circle"></i></button>
        `;
        div.onclick = () => { this.playSource = 'search'; this.playTrack(song); };
        div.querySelector('button').onclick = (e) => { e.stopPropagation(); this.saveToLibrary(song); };
        list.appendChild(div);
    },

    updateLibraryUI() {
        const list = document.getElementById('playlist-items');
        list.innerHTML = this.myLibrary.length === 0 ? '<p style="color:gray;text-align:center;padding:50px;">Library Kosong</p>' : '';
        this.myLibrary.forEach((song, index) => {
            const div = document.createElement('div');
            div.className = 'song-item';
            div.innerHTML = `<img src="${song.thumbnail}" class="song-thumb"><div class="song-meta">
                <div class="song-name">${song.title}</div><div class="song-sub">${song.author}</div>
                </div><button class="btn-action" style="color:var(--accent)"><i class="fas fa-trash-alt"></i></button>`;
            div.onclick = () => { this.playSource = 'library'; this.currentIndex = index; this.playTrack(song); };
            div.querySelector('button').onclick = (e) => this.removeFromLibrary(index, e);
            list.appendChild(div);
        });
        document.getElementById('lib-count').innerText = `${this.myLibrary.length} Lagu`;
    },

    // --- PLAYER CORE ---
    playTrack(song) {
        const audio = document.getElementById('audio-engine');
        document.getElementById('master-player').style.display = 'flex';
        
        // Update Mini & Full UI
        const elements = {
            'track-thumb': song.thumbnail, 'full-track-thumb': song.thumbnail,
            'track-name': song.title, 'full-track-name': song.title,
            'track-artist': song.author, 'full-track-artist': song.author
        };
        for (let id in elements) document.getElementById(id).src = document.getElementById(id).innerText = elements[id];
        
        // Backgrounds
        document.getElementById('player-dynamic-bg').style.backgroundImage = `url('${song.thumbnail}')`;
        document.getElementById('full-player-bg').style.backgroundImage = `url('${song.thumbnail}')`;

        audio.src = song.mp3;
        audio.play().catch(() => this.showToast("Gagal memutar lagu"));
    },

    togglePlay() {
        const audio = document.getElementById('audio-engine');
        if (audio.paused) audio.play(); else audio.pause();
    },

    nextTrack() {
        if (this.myLibrary.length === 0) return;
        this.currentIndex = (this.currentIndex + 1) % this.myLibrary.length;
        this.playSource = 'library';
        this.playTrack(this.myLibrary[this.currentIndex]);
    },

    prevTrack() {
        if (this.myLibrary.length === 0) return;
        this.currentIndex = (this.currentIndex - 1 + this.myLibrary.length) % this.myLibrary.length;
        this.playSource = 'library';
        this.playTrack(this.myLibrary[this.currentIndex]);
    },

    toggleRepeat() {
        this.isRepeat = !this.isRepeat;
        document.getElementById('repeat-btn').style.color = this.isRepeat ? 'var(--primary)' : 'white';
        this.showToast(this.isRepeat ? "Repeat ON" : "Repeat OFF");
    },

    formatTime(s) {
        if (isNaN(s)) return "0:00";
        const m = Math.floor(s / 60); const sec = Math.floor(s % 60);
        return `${m}:${sec < 10 ? '0' : ''}${sec}`;
    },

    setupEventListeners() {
        const audio = document.getElementById('audio-engine');
        const sliderMini = document.getElementById('progress-slider');
        const sliderFull = document.getElementById('full-progress-slider');

        document.getElementById('search-input').onkeypress = (e) => { if(e.key === 'Enter') this.performSearch(); };

        audio.onplay = () => {
            document.getElementById('play-toggle').innerHTML = '<i class="fas fa-pause-circle"></i>';
            document.getElementById('play-toggle-full').innerHTML = '<i class="fas fa-pause-circle"></i>';
        };
        audio.onpause = () => {
            document.getElementById('play-toggle').innerHTML = '<i class="fas fa-play-circle"></i>';
            document.getElementById('play-toggle-full').innerHTML = '<i class="fas fa-play-circle"></i>';
        };

        audio.ontimeupdate = () => {
            if (!this.isDragging && audio.duration) {
                const cur = Math.floor(audio.currentTime);
                const dur = Math.floor(audio.duration);
                [sliderMini, sliderFull].forEach(s => { s.max = dur; s.value = cur; });
                document.getElementById('time-now').innerText = document.getElementById('full-time-now').innerText = this.formatTime(cur);
                document.getElementById('time-total').innerText = document.getElementById('full-time-total').innerText = this.formatTime(dur);
            }
        };

        audio.onended = () => {
            if (this.isRepeat) { audio.currentTime = 0; audio.play(); }
            else if (this.playSource === 'library') this.nextTrack();
        };

        [sliderMini, sliderFull].forEach(s => {
            s.oninput = () => { this.isDragging = true; };
            s.onchange = () => { audio.currentTime = s.value; this.isDragging = false; };
        });
    },

    initVisuals() {
        const canvas = document.getElementById('canvas-bg');
        const ctx = canvas.getContext('2d');
        let particles = [];
        const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
        window.onresize = resize; resize();
        for(let i=0; i<50; i++) particles.push({ x: Math.random()*canvas.width, y: Math.random()*canvas.height, size: Math.random()*1.5, spX: (Math.random()-0.5)*0.3, spY: (Math.random()-0.5)*0.3 });
        const animate = () => {
            ctx.clearRect(0,0, canvas.width, canvas.height);
            ctx.fillStyle = 'rgba(0, 255, 136, 0.15)';
            particles.forEach(p => {
                p.x += p.spX; p.y += p.spY;
                if(p.x < 0 || p.x > canvas.width) p.spX *= -1;
                if(p.y < 0 || p.y > canvas.height) p.spY *= -1;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
            });
            requestAnimationFrame(animate);
        };
        animate();
    }
};

document.addEventListener('DOMContentLoaded', () => logic.init());
