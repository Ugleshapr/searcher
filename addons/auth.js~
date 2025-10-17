// addons/auth.js
(() => {
  const $ = sel => document.querySelector(sel);
  function cacheUsername(u){ try{ localStorage.setItem('auth:username', u || ''); }catch{} }
function getCachedUsername(){ try{ return localStorage.getItem('auth:username') || ''; }catch{ return ''; } }

const statusBox = document.getElementById('authStatus');

function setStatus(msg = '', type = 'info'){
  if (!statusBox) return;
  statusBox.textContent = msg;
  statusBox.classList.remove('is-success','is-error');
  if (type === 'success') statusBox.classList.add('is-success');
  if (type === 'error')   statusBox.classList.add('is-error');
}

function withLoading(btn, fn){
  return async (...args) => {
    if (!btn) return;
    btn.classList.add('is-loading');
    try { return await fn(...args); }
    finally { btn.classList.remove('is-loading'); }
  }
}

  const tab = $('#authTab');
  const peek = tab?.querySelector('.auth-tab__peek');
  const vOut = $('#authLoggedOut');
  const vIn  = $('#authLoggedIn');
  const title = $('#authTitle');
  const emailEl = $('#authUserEmail');
  const inEmail = $('#authEmail');
  const inPass  = $('#authPass');
  const btnLogin = $('#btnLogin');
  const btnRegister = $('#btnRegister');
  const btnLogout = $('#btnLogout');
  const btnLoginGoogle = $('#btnLoginGoogle');
  

  function showLogged(user){
    if (!vOut || !vIn) return;
    if (user){
      vOut.style.display = 'none';
      vIn.style.display = '';
      title.textContent = 'Аккаунт';
      emailEl.textContent = user.email || '';
    }else{
      vOut.style.display = '';
      vIn.style.display = 'none';
      title.textContent = 'Гость';
      emailEl.textContent = '';
    }
  }

  // --- выезд/скрытие панели с задержкой ---
let hideTmr = null;
function openTab(){ tab?.classList.add('auth-tab--open'); }
function closeTab(){ tab?.classList.remove('auth-tab--open'); }
function scheduleHide(ms=1000){
  clearTimeout(hideTmr);
  hideTmr = setTimeout(closeTab, ms);
}
function cancelHide(){ clearTimeout(hideTmr); }

// показывать при наведении на ушко/фокус
peek?.addEventListener('mouseenter', openTab);
peek?.addEventListener('click',      openTab);

// если курсор зашёл в область панели — отменяем автоскрытие
tab?.addEventListener('mouseenter',  cancelHide);
// как только вышли мышью с панели или ушка — прячем через 2с
tab?.addEventListener('mouseleave',  () => scheduleHide(1000));

  
  // закрыть по клику вне панели
document.addEventListener('click', (e) => {
  if (!tab) return;
  const within = tab.contains(e.target);
  if (!within) tab.classList.remove('auth-tab--open');
});

// закрыть по Esc
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') tab?.classList.remove('auth-tab--open');
});


  // ---- Firebase (лениво) ----
  let auth, app, _mods;
  const firebaseConfig = {
     apiKey: "AIzaSyBxENxmzeWCU-pRdig5YG74PK3aL15XunA",
     authDomain: "searcher-589d2.firebaseapp.com",
     projectId: "searcher-589d2",
  };

  async function ensureFirebase(){
    if (auth) return auth;
    const [{ initializeApp }] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js'),
    ]);
        _mods = await import('https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js');
        const fmods = await import('https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js');
const { getFirestore, doc, getDoc, setDoc, runTransaction, serverTimestamp } = fmods;

let db; // объявляем, но не инициализируем


// нормализация и валидация логина
function normalizeUsername(s){
  return (s || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
}

async function getUserProfile(uid){
  // 1) пробуем кэш
  const cached = getCachedUsername();
  if (cached) return { username: cached }; // достаточно для UI

  // 2) читаем Firestore один раз
  const profRef = doc(db, 'users', uid);
  const snap = await getDoc(profRef);
  const data = snap.exists() ? snap.data() : {};
  if (data.username) cacheUsername(data.username);
  return data;
}

async function showOrHideUsernameBox(user){
  const box = document.getElementById('usernameBox');
  if (!box) return;
  if (!user){ box.style.display = 'none'; return; }

  const profile = await getUserProfile(user.uid);
  const hasUsername = !!profile.username;
  box.style.display = hasUsername ? 'none' : '';
  // заголовок панели: @username если есть
  if (hasUsername) {
    title.textContent = '@' + profile.username;
  } else {
    title.textContent = 'Аккаунт';
  }
}

function isUsernameValid(u){ return /^[a-z0-9_]{3,20}$/.test(u); }

// --- Username claim (транзакция) ---
const uInput   = document.getElementById('usernameInput');
const btnClaim = document.getElementById('btnClaimUsername');
if (btnClaim && uInput) btnClaim.disabled = !isUsernameValid(normalizeUsername(uInput.value));

// Мягкая нормализация и блокировка кнопки, пока логин невалиден
uInput?.addEventListener('input', () => {
  const v = normalizeUsername(uInput.value);
  if (uInput.value !== v) uInput.value = v;
  btnClaim && (btnClaim.disabled = !isUsernameValid(v));
});

// Submit по Enter
uInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btnClaim?.click();
});

btnClaim?.addEventListener('click', withLoading(btnClaim, async () => {
  if (!auth?.currentUser) { setStatus('Нужно войти', 'error'); return; }

  const raw = uInput?.value || '';
  const username = normalizeUsername(raw);
  if (!isUsernameValid(username)) {
    setStatus('3–20 символов: a-z, 0-9, _', 'error'); return;
  }

  const uid = auth.currentUser.uid;
  const unameRef = doc(db, 'usernames', username);
  const userRef  = doc(db, 'users', uid);

  try{
    await runTransaction(db, async (tx) => {
      // 1) логин свободен?
      const uSnap = await tx.get(unameRef);
      if (uSnap.exists()) throw new Error('Этот логин уже занят');

      // 2) пользователь ещё без логина?
      const pSnap = await tx.get(userRef);
      if (pSnap.exists() && pSnap.data().username) {
        throw new Error('Логин уже установлен');
      }

      // 3) резервируем и пишем в профиль
      tx.set(unameRef, { uid, createdAt: serverTimestamp() });
      tx.set(userRef, {
        username,
        displayName: auth.currentUser.displayName || null,
        email: auth.currentUser.email || null,
        updatedAt: serverTimestamp()
      }, { merge: true });
    });

    cacheUsername(username);
    title.textContent = '@' + username;           // ← сразу показываем в заголовке
    setStatus('Логин забронирован ✅', 'success');
    const box = document.getElementById('usernameBox'); if (box) box.style.display = 'none';
  }catch(e){
    setStatus(e?.message || 'Не удалось забронировать логин', 'error');
  }
}));


    const {
      getAuth, onAuthStateChanged,
      signInWithEmailAndPassword,
      createUserWithEmailAndPassword,
      signOut,
      GoogleAuthProvider, signInWithPopup
    } = _mods;

    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    const { setPersistence, browserLocalPersistence } = _mods;
await setPersistence(auth, browserLocalPersistence);
db = getFirestore(app); // ← теперь app уже есть


    // Слушатель состояния
    onAuthStateChanged(auth, async (user) => {
  showLogged(user);
  if (user) {
    setStatus('Вы авторизованы', 'success');
    // сразу попробуем кэш → если нет — подтянем из Firestore
    const cached = getCachedUsername();
    if (cached) {
      title.textContent = '@' + cached;
      // бокс скрыть и на всякий случай асинхронно синхронизировать
      const box = document.getElementById('usernameBox'); if (box) box.style.display = 'none';
      getUserProfile(user.uid).then(()=>{}).catch(()=>{});
    } else {
      await showOrHideUsernameBox(user);
    }
  } else {
    setStatus('');
    title.textContent = 'Гость';
    cacheUsername('');
    const box = document.getElementById('usernameBox'); if (box) box.style.display = 'none';
  }
});



    // Email/Password
    
btnLogin?.addEventListener('click', withLoading(btnLogin, async () => {
  const email = inEmail?.value?.trim(), pass = inPass?.value || '';
  if (!email || !pass) { setStatus('Введите email и пароль', 'error'); return; }
  await _mods.signInWithEmailAndPassword(auth, email, pass);
  inPass.value = '';
  setStatus('Вход выполнен ✅', 'success');
}));

btnRegister?.addEventListener('click', withLoading(btnRegister, async () => {
  const email = inEmail?.value?.trim(), pass = inPass?.value || '';
  if (!email || !pass) { setStatus('Введите email и пароль', 'error'); return; }
  await _mods.createUserWithEmailAndPassword(auth, email, pass);
  inPass.value = '';
  setStatus('Аккаунт создан и вход выполнен ✅', 'success');
}));

btnLogout?.addEventListener('click', withLoading(btnLogout, async () => {
  await _mods.signOut(auth);
  setStatus('Вы вышли', 'info');
}));

// Google
btnLoginGoogle?.addEventListener('click', withLoading(btnLoginGoogle, async () => {
  try{
    const provider = new _mods.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await _mods.signInWithPopup(auth, provider);
    setStatus('Вход через Google выполнен ✅', 'success');
  }catch(e){
    if (String(e?.message || e).includes('popup-closed-by-user')) return;
    setStatus('Ошибка Google-входа: ' + (e?.message || e), 'error');
  }
}));


    return auth;
  }

  // Ленивая инициализация только при первом взаимодействии
  [inEmail, inPass, btnLogin, btnRegister, btnLogout, btnLoginGoogle, peek]
    .forEach(el => {
      el?.addEventListener('pointerdown', ensureFirebase, { once: true });
      el?.addEventListener('focus',       ensureFirebase, { once: true });
    });

  document.addEventListener('DOMContentLoaded', () => {
  ensureFirebase().catch(console.error);
});
})();

