// Nama pemain, layar login nama, status online, dan toast (dipakai semua mode).
import { S } from '../core/state.js';
import { go } from './router.js';

export function updateOnlineStatus() {
    const el = document.getElementById('online-status');
    if (!el) return;
    el.innerText = S.fbUser ? "🟢 Mode online siap" : "🔴 Mode online tidak aktif (cek firebaseConfig). Mode offline tetap bisa dimainkan.";
}

export function updateHomeName() {
    document.querySelectorAll('.my-name').forEach(el => { el.innerText = S.myName; });
}

window.saveName = () => {
    const nameInput = document.getElementById('player-name').value.trim();
    if (nameInput.length < 2) return showToast("Nama minimal 2 huruf!");
    S.myName = nameInput;
    localStorage.setItem('uno_name', S.myName);
    document.getElementById('btn-cancel-name').classList.add('hidden');
    updateHomeName();
    updateOnlineStatus();
    go('home-screen');
};

window.changeName = () => {
    document.getElementById('player-name').value = S.myName;
    document.getElementById('btn-cancel-name').classList.remove('hidden');
    go('login-screen');
};

window.cancelName = () => {
    document.getElementById('btn-cancel-name').classList.add('hidden');
    go('home-screen');
};

let toastTimeout;
window.showToast = (msg) => {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.classList.remove('toast-enter');
    toast.classList.add('toast-show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove('toast-show');
        toast.classList.add('toast-enter');
    }, 3000);
};
