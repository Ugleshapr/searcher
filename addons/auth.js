// addons/auth.js
(() => {
  const $ = sel => document.querySelector(sel);
  const tab = $('#authTab');
  const peek = tab?.querySelector('.auth-tab__peek');
  const closeBtn = $('#authClose');
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

  function toast(msg){ alert(msg); }
  function setLoading(on){
    [btnLogin, btnRegister, btnLogout, btnLoginGoogle].forEach(b => b && (b.disabled = !!on));
  }
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

  // выезд панели
  tab?.classList.remove('auth-tab--open');
  peek?.addEventListener('mouseenter', () => tab.classList.add('auth-tab--open'));
  peek?.addEventListener('click',      () => tab.classList.add('auth-tab--open'));
  closeBtn?.addEventListener('click',  () => tab.classList.remove('auth-tab--open'));

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

    // Слушатель состояния
    onAuthStateChanged(auth, (user) => showLogged(user));

    // Email/Password
    btnLogin?.addEventListener('click', async () => {
      const email = inEmail?.value?.trim(), pass = inPass?.value || '';
      if (!email || !pass) return toast('Введите email и пароль');
      try{
        setLoading(true);
        await signInWithEmailAndPassword(auth, email, pass);
        toast('Готово: вы вошли.');
        inPass.value = '';
      }catch(e){ toast('Ошибка входа: ' + (e?.message || e)); }
      finally{ setLoading(false); }
    });

    btnRegister?.addEventListener('click', async () => {
      const email = inEmail?.value?.trim(), pass = inPass?.value || '';
      if (!email || !pass) return toast('Введите email и пароль');
      try{
        setLoading(true);
        await createUserWithEmailAndPassword(auth, email, pass);
        toast('Аккаунт создан и вы вошли.');
        inPass.value = '';
      }catch(e){ toast('Ошибка регистрации: ' + (e?.message || e)); }
      finally{ setLoading(false); }
    });

    btnLogout?.addEventListener('click', async () => {
      try{
        setLoading(true);
        await signOut(auth);
        toast('Вы вышли.');
      }catch(e){ toast('Ошибка выхода: ' + (e?.message || e)); }
      finally{ setLoading(false); }
    });

    // Google Sign-In (popup)
    btnLoginGoogle?.addEventListener('click', async () => {
      try{
        setLoading(true);
        const provider = new _mods.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await _mods.signInWithPopup(auth, provider);
        toast('Вход через Google выполнен.');
      }catch(e){
        // Пользователь мог закрыть окно — это ок
        if (String(e?.message || e).includes('popup-closed-by-user')) return;
        toast('Ошибка Google-входа: ' + (e?.message || e));
      }finally{ setLoading(false); }
    });

    return auth;
  }

  // Ленивая инициализация только при первом взаимодействии
  [inEmail, inPass, btnLogin, btnRegister, btnLogout, btnLoginGoogle, peek]
    .forEach(el => {
      el?.addEventListener('pointerdown', ensureFirebase, { once: true });
      el?.addEventListener('focus',       ensureFirebase, { once: true });
    });

  // Гость по умолчанию
  showLogged(null);
})();

