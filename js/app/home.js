// Beranda: logo, tab Offline/Online, bagian "Klasik" dan "Mode Lain" (dibuat dari daftar MODES).
import { S, esc } from '../core/state.js';
import { GROUPS, MODES, getImpl, getMode } from './modes.js';
import { go } from './router.js';
import { warmMode } from '../core/loader.js';
import { askRounds } from './rounds.js';

const store = {
    get(k, d) { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* abaikan */ } }
};

let tab = store.get('uno_tab', 'offline') === 'online' ? 'online' : 'offline';
const botsOf = (m) => Math.max(m.bots.min, Math.min(m.bots.max, parseInt(store.get('uno_bots_' + m.id, m.bots.def)) || m.bots.def));

function cardHTML(m) {
    const art = m.art.map((src, i) => `<img class="mc-art" style="--i:${i};--n:${m.art.length}" src="${src}" alt="" draggable="false">`).join('');
    let action;
    if (!m.ready) {
        action = `<div class="mc-soon">Segera hadir</div>`;
    } else if (tab === 'offline') {
        const n = botsOf(m);
        action = `<div class="mc-row">
            <div class="mc-step"><button class="mc-stepbtn" onclick="stepBots('${m.id}', -1)" aria-label="Kurangi lawan">−</button>
            <span class="mc-stepval"><b>${n}</b> lawan</span>
            <button class="mc-stepbtn" onclick="stepBots('${m.id}', 1)" aria-label="Tambah lawan">+</button></div>
            <button class="mc-play" onclick="playMode('${m.id}')">Main ▶</button></div>`;
    } else if (m.online === false) {
        action = `<div class="mc-soon">Online segera hadir</div>`;
    } else {
        action = `<div class="mc-row"><button class="mc-play mc-play-wide" onclick="playMode('${m.id}')">Buat / Gabung ▶</button></div>`;
    }
    // seperti sisi kotak UNO: logo di kiri, kartu menumpuk rapat di kanan, tanpa teks di tengah
    return `<div class="mode-card ${m.ready ? '' : 'mc-off'}" aria-label="${esc(m.name)}">
        <div class="mc-poster mc-${m.theme}"><img class="mc-logo" src="${m.logo}" alt="${esc(m.name)}" draggable="false"><div class="mc-tag">${esc(m.tag || '')}</div><div class="mc-fan">${art}</div><img class="mc-badge" src="${m.badge}" alt="2-${m.bots.max + 1} pemain, 7+ tahun" draggable="false"></div>
        ${action}
    </div>`;
}

export function renderHome() {
    document.getElementById('tab-offline').classList.toggle('on', tab === 'offline');
    document.getElementById('tab-online').classList.toggle('on', tab === 'online');
    document.getElementById('home-sub').innerText = tab === 'offline' ? 'Main sendiri melawan komputer' : 'Main bersama teman lewat kode ruangan';
    document.getElementById('home-sections').innerHTML = GROUPS.map(g => {
        const list = MODES.filter(m => m.group === g.id);
        if (!list.length) return '';
        return `<section class="home-sec"><h2 class="sec-title"><span>${esc(g.title)}</span></h2>${list.map(cardHTML).join('')}</section>`;
    }).join('');
}

window.setHomeTab = (t) => { tab = t === 'online' ? 'online' : 'offline'; store.set('uno_tab', tab); renderHome(); };

window.stepBots = (id, d) => {
    const m = getMode(id); if (!m) return;
    store.set('uno_bots_' + id, Math.max(m.bots.min, Math.min(m.bots.max, botsOf(m) + d)));
    renderHome();
};

window.playMode = (id) => {
    const m = getMode(id), impl = getImpl(id);
    if (!m || !m.ready || !impl) return showToast('Mode ini belum tersedia.');
    S.mode = id;
    if (tab === 'offline') {
        askRounds(id, botsOf(m));   // pop-up "Main berapa ronde?"; gambar dimuat & permainan dimulai setelah memilih (rounds.js)
    } else {
        warmMode(id);            // online: gambar dimuat diam-diam selagi di halaman online / lobi
        window.openOnlineHub(id);
    }
};
