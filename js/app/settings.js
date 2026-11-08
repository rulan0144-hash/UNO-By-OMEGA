// Pengaturan di beranda: nama dan suara (penggeser volume diurus oleh core/sound.js).
const el = (id) => document.getElementById(id);
window.openSettings = () => el('settings-modal').classList.remove('hidden');
window.closeSettings = () => el('settings-modal').classList.add('hidden');
window.settingsChangeName = () => { window.closeSettings(); window.changeName(); };
