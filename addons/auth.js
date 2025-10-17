// addons/auth.js
(() => {
  const $ = sel => document.querySelector(sel);
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
function scheduleHide(ms=2000){
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
tab?.addEventListener('mouseleave',  () => scheduleHide(2000));

  
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


    // Слушатель состояния
    onAuthStateChanged(auth, (user) => {
  showLogged(user);
  if (user) setStatus('Вы авторизованы', 'success'); else setStatus('');
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

