APP_JS = "export const initializeApp = () => ({});"
AUTH_JS = """
export const getAuth = () => ({ currentUser: null });
export const signInAnonymously = async (auth) => { auth.currentUser = { uid: window.__uid }; };
export const signInWithCustomToken = async (auth) => { auth.currentUser = { uid: window.__uid }; };
"""
FS_JS = """
export const getFirestore = () => ({});
export const doc = (db, ...segs) => ({ path: segs.join('/') });
function check(v, p) {
  if (v === undefined) throw new Error('Firestore menolak undefined di ' + p);
  if (Array.isArray(v)) v.forEach((x, i) => { if (Array.isArray(x)) throw new Error('Firestore menolak array bersarang di ' + p + '[' + i + ']'); check(x, p + '[' + i + ']'); });
  else if (v && typeof v === 'object') Object.keys(v).forEach(k => check(v[k], p + '.' + k));
}
const call = async (op, path, data) => { const r = await window.__fsOp(op, path, data === undefined ? null : JSON.stringify(data)); return r ? JSON.parse(r) : null; };
const snap = (d) => ({ exists: () => d !== null, data: () => d });
const subs = {};
export const setDoc = async (ref, data) => { check(data, 'doc'); await call('set', ref.path, data); };
export const getDoc = async (ref) => snap(await call('get', ref.path));
export const updateDoc = async (ref, data) => { check(data, 'doc'); await call('update', ref.path, data); };
export const deleteDoc = async (ref) => { await call('delete', ref.path); };
export const onSnapshot = (ref, cb) => {
  (subs[ref.path] ||= new Set()).add(cb);
  call('get', ref.path).then(d => { if (subs[ref.path].has(cb)) cb(snap(d)); });
  return () => subs[ref.path].delete(cb);
};
window.__fsNotify = (path, json) => { const d = json === null ? null : JSON.parse(json); [...(subs[path] || [])].forEach(cb => cb(snap(d))); };
"""
