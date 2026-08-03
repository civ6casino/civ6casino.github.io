// Civ 6 Şeref Listesi — shared login widget + session handling.
// Loaded on every page right after config.js. Renders into <div id="auth-widget"></div>
// which must exist in the header markup. Sessions persist automatically via
// supabase-js (stored in localStorage), so a logged-in user stays logged in
// across visits until they explicitly log out.

const EMAIL_DOMAIN = 'civ6players.local';

const Civ6Auth = (() => {
  let currentUser = null;
  let currentUsername = null;
  let isAdmin = false;
  let playerName = null;
  let dropdownOpen = false;
  const listeners = [];

  function usernameToEmail(username) {
    const safe = username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    return `${safe}@${EMAIL_DOMAIN}`;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function onChange(cb) { listeners.push(cb); }
  function notify() { listeners.forEach(cb => cb()); }

  async function refresh() {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
      currentUser = null;
      currentUsername = null;
      isAdmin = false;
      playerName = null;
      renderWidget();
      notify();
      return;
    }

    currentUser = session.user;

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('username, is_admin, player_name')
      .eq('id', currentUser.id)
      .maybeSingle();

    if (!profile) {
      currentUsername = null;
      isAdmin = false;
      playerName = null;
    } else {
      currentUsername = profile.username;
      isAdmin = !!profile.is_admin;
      playerName = profile.player_name || null;
    }

    renderWidget();
    notify();
  }

  async function login(username, password) {
    return supabaseClient.auth.signInWithPassword({ email: usernameToEmail(username), password });
  }

  async function signup(username, password) {
    const { data: existing } = await supabaseClient
      .from('profiles').select('username').ilike('username', username).maybeSingle();
    if (existing) return { error: { message: 'Bu kullanıcı adı zaten alınmış.' } };

    const { data, error } = await supabaseClient.auth.signUp({ email: usernameToEmail(username), password });
    if (error) return { error };

    const userId = data.user?.id;
    if (userId) {
      const { error: profileErr } = await supabaseClient.from('profiles').insert({ id: userId, username });
      if (profileErr) return { error: profileErr };
    }
    return { error: null };
  }

  async function claimUsername(username) {
    const { data: existing } = await supabaseClient
      .from('profiles').select('username').ilike('username', username).maybeSingle();
    if (existing) return { error: { message: 'Bu kullanıcı adı zaten alınmış.' } };
    const { error } = await supabaseClient.from('profiles').insert({ id: currentUser.id, username });
    return { error };
  }

  async function logout() {
    await supabaseClient.auth.signOut();
    dropdownOpen = false;
    await refresh();
  }

  function toggleDropdown() {
    dropdownOpen = !dropdownOpen;
    const dd = document.getElementById('auth-dropdown');
    if (dd) dd.style.display = dropdownOpen ? 'block' : 'none';
  }

  function closeDropdown() {
    dropdownOpen = false;
    const dd = document.getElementById('auth-dropdown');
    if (dd) dd.style.display = 'none';
  }

  function renderWidget() {
    const el = document.getElementById('auth-widget');
    if (!el) return;

    if (currentUser && currentUsername) {
      el.innerHTML = `
        <button type="button" class="auth-btn" id="auth-toggle-btn">👤 ${escapeHtml(currentUsername)}${isAdmin ? ' ⚔️' : ''} ▾</button>
        <div class="auth-dropdown" id="auth-dropdown" style="display:${dropdownOpen ? 'block' : 'none'};">
          <p class="muted" style="margin-top:0;">Giriş yapan: <strong>${escapeHtml(currentUsername)}</strong>${isAdmin ? ' · <span class="pill">Yönetici</span>' : ''}</p>
          ${playerName ? `<button type="button" class="secondary" id="profile-link-btn">🎭 Profilim</button>` : ''}
          <button type="button" class="secondary" id="logout-btn">Çıkış Yap</button>
        </div>
      `;
      if (playerName) {
        document.getElementById('profile-link-btn').addEventListener('click', () => {
          location.href = `profil.html?oyuncu=${encodeURIComponent(playerName)}`;
        });
      }
      document.getElementById('logout-btn').addEventListener('click', logout);
    } else if (currentUser && !currentUsername) {
      el.innerHTML = `
        <button type="button" class="auth-btn" id="auth-toggle-btn">🏷️ Kullanıcı Adı Seç ▾</button>
        <div class="auth-dropdown" id="auth-dropdown" style="display:${dropdownOpen ? 'block' : 'none'};">
          <p class="muted" style="margin-top:0;">Giriş yaptın ama henüz bir kullanıcı adı seçmedin.</p>
          <label>Kullanıcı Adı</label>
          <input type="text" id="claim-username" placeholder="örn. Alperen">
          <button type="button" id="claim-btn">Kaydet</button>
          <button type="button" class="secondary" id="claim-logout-btn">Çıkış Yap</button>
          <div class="auth-msg" id="claim-msg"></div>
        </div>
      `;
      document.getElementById('claim-btn').addEventListener('click', async () => {
        const msgEl = document.getElementById('claim-msg');
        msgEl.textContent = '';
        msgEl.className = 'auth-msg';
        const username = document.getElementById('claim-username').value.trim();
        if (!username || username.length < 2) {
          msgEl.textContent = 'En az 2 karakterden oluşan bir kullanıcı adı seç.';
          msgEl.className = 'auth-msg error';
          return;
        }
        const { error } = await claimUsername(username);
        if (error) {
          msgEl.textContent = error.message;
          msgEl.className = 'auth-msg error';
          return;
        }
        dropdownOpen = false;
        await refresh();
      });
      document.getElementById('claim-logout-btn').addEventListener('click', logout);
    } else {
      el.innerHTML = `
        <button type="button" class="auth-btn" id="auth-toggle-btn">Giriş Yap</button>
        <div class="auth-dropdown" id="auth-dropdown" style="display:${dropdownOpen ? 'block' : 'none'};">
          <div class="tab-row" id="auth-tabs">
            <button type="button" id="tab-login">Giriş Yap</button>
            <button type="button" id="tab-signup" class="inactive">Hesap Oluştur</button>
          </div>
          <div id="login-panel-mini">
            <label>Kullanıcı Adı</label>
            <input type="text" id="login-username" placeholder="Kullanıcı adın">
            <label>Şifre</label>
            <input type="password" id="login-password" placeholder="Şifren">
            <button type="button" id="login-btn">Giriş Yap</button>
            <div class="auth-msg" id="login-msg"></div>
          </div>
          <div id="signup-panel-mini" style="display:none;">
            <label>Bir kullanıcı adı seç</label>
            <input type="text" id="signup-username" placeholder="örn. Alperen">
            <label>Bir şifre seç</label>
            <input type="password" id="signup-password" placeholder="En az 6 karakter">
            <button type="button" id="signup-btn">Hesap Oluştur</button>
            <div class="auth-msg" id="signup-msg"></div>
          </div>
        </div>
      `;

      const tabLogin = document.getElementById('tab-login');
      const tabSignup = document.getElementById('tab-signup');
      const loginPanel = document.getElementById('login-panel-mini');
      const signupPanel = document.getElementById('signup-panel-mini');

      tabLogin.addEventListener('click', () => {
        tabLogin.classList.remove('inactive');
        tabSignup.classList.add('inactive');
        loginPanel.style.display = 'block';
        signupPanel.style.display = 'none';
      });
      tabSignup.addEventListener('click', () => {
        tabSignup.classList.remove('inactive');
        tabLogin.classList.add('inactive');
        signupPanel.style.display = 'block';
        loginPanel.style.display = 'none';
      });

      document.getElementById('login-btn').addEventListener('click', async () => {
        const msgEl = document.getElementById('login-msg');
        msgEl.textContent = '';
        msgEl.className = 'auth-msg';
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        if (!username || !password) {
          msgEl.textContent = 'Kullanıcı adı ve şifre gir.';
          msgEl.className = 'auth-msg error';
          return;
        }
        const { error } = await login(username, password);
        if (error) {
          msgEl.textContent = 'Kullanıcı adı veya şifre hatalı.';
          msgEl.className = 'auth-msg error';
          return;
        }
        dropdownOpen = false;
        await refresh();
      });

      document.getElementById('signup-btn').addEventListener('click', async () => {
        const msgEl = document.getElementById('signup-msg');
        msgEl.textContent = '';
        msgEl.className = 'auth-msg';
        const username = document.getElementById('signup-username').value.trim();
        const password = document.getElementById('signup-password').value;
        if (!username || username.length < 2) {
          msgEl.textContent = 'En az 2 karakterden oluşan bir kullanıcı adı seç.';
          msgEl.className = 'auth-msg error';
          return;
        }
        if (!password || password.length < 6) {
          msgEl.textContent = 'Şifre en az 6 karakter olmalı.';
          msgEl.className = 'auth-msg error';
          return;
        }
        const { error } = await signup(username, password);
        if (error) {
          msgEl.textContent = error.message;
          msgEl.className = 'auth-msg error';
          return;
        }
        dropdownOpen = false;
        await refresh();
      });
    }

    document.getElementById('auth-toggle-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDropdown();
    });
  }

  document.addEventListener('click', (e) => {
    const widget = document.getElementById('auth-widget');
    if (widget && !widget.contains(e.target) && dropdownOpen) {
      closeDropdown();
    }
  });

  return {
    refresh,
    onChange,
    logout,
    get currentUser() { return currentUser; },
    get currentUsername() { return currentUsername; },
    get isAdmin() { return isAdmin; },
    get playerName() { return playerName; },
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  Civ6Auth.refresh();
});
