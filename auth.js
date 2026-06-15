'use strict';

const supabaseClient = window.hdcSupabase;

document.addEventListener('DOMContentLoaded', async () => {
  if (!supabaseClient) {
    showMessage(
      'loginMessage',
      window.hdcSupabaseError || 'Konfigurasi Supabase belum valid. Cek supabase-config.js.',
      'error',
    );
    return;
  }

  bindTabs();
  bindLogin();
  bindRegister();
  bindGenderOptions();
  bindDemoButton();
  bindAuthLinks();
  initContinueSession();
});

function bindTabs() {
  const loginTab = document.getElementById('loginTab');
  const registerTab = document.getElementById('registerTab');

  loginTab.addEventListener('click', () => setAuthMode('login'));
  registerTab.addEventListener('click', () => setAuthMode('register'));
}

function bindLogin() {
  document.getElementById('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = getEmailValue('loginEmail');
    const password = getValue('loginPassword');

    if (!email && !password) {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();

      if (session) {
        showMessage('loginMessage', 'Session masih aktif. Mengalihkan...', 'success');
        window.location.href = 'dashboard.html';
        return;
      }
    }

    if (!isValidEmail(email)) {
      showMessage('loginMessage', 'Format email belum valid.', 'error');
      return;
    }

    setFormBusy('loginForm', true);
    showMessage('loginMessage', 'Memeriksa akun...', 'success');

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setFormBusy('loginForm', false);
      showMessage('loginMessage', getAuthErrorMessage(error.message), 'error');
      return;
    }

    await ensureProfile(data.user);
    showMessage('loginMessage', 'Berhasil masuk. Mengalihkan...', 'success');
    window.location.href = 'dashboard.html';
  });
}

function bindRegister() {
  document.getElementById('registerForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = getValue('registerName');
    const email = getEmailValue('registerEmail');
    const gender = getValue('registerGender');
    const password = getValue('registerPassword');
    const confirm = getValue('confirmPassword');

    if (!gender) {
      showMessage('registerMessage', 'Pilih jenis kelamin terlebih dahulu.', 'error');
      return;
    }

    if (!isValidEmail(email)) {
      showMessage('registerMessage', 'Format email belum valid.', 'error');
      return;
    }

    if (password.length < 6) {
      showMessage('registerMessage', 'Password minimal 6 karakter.', 'error');
      return;
    }

    if (password !== confirm) {
      showMessage('registerMessage', 'Konfirmasi password belum sama.', 'error');
      return;
    }

    setFormBusy('registerForm', true);
    showMessage('registerMessage', 'Membuat akun...', 'success');

    const patientCode = makePatientId();
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          gender,
          patient_code: patientCode,
        },
      },
    });

    if (error) {
      setFormBusy('registerForm', false);
      showMessage('registerMessage', getAuthErrorMessage(error.message), 'error');
      return;
    }

    if (data.user && data.session) {
      await upsertProfile({
        id: data.user.id,
        full_name: name,
        email,
        gender,
        patient_code: patientCode,
      });
    }

    if (!data.session) {
      setFormBusy('registerForm', false);
      showMessage('registerMessage', 'Akun dibuat. Cek email untuk konfirmasi sebelum login.', 'success');
      setAuthMode('login');
      return;
    }

    showMessage('registerMessage', 'Akun dibuat. Mengalihkan...', 'success');
    window.location.href = 'dashboard.html';
  });
}

function bindGenderOptions() {
  const genderInput = document.getElementById('registerGender');
  const options = document.querySelectorAll('.gender-option');

  options.forEach((option) => {
    option.addEventListener('click', () => {
      genderInput.value = option.dataset.gender || '';

      options.forEach((item) => {
        const isActive = item === option;
        item.classList.toggle('active', isActive);
        item.setAttribute('aria-pressed', String(isActive));
      });
    });
  });
}

function bindDemoButton() {
  document.getElementById('fillDemo')?.addEventListener('click', () => {
    document.getElementById('loginEmail').value = 'andi@email.com';
    document.getElementById('loginPassword').value = 'andi123';
    showMessage('loginMessage', 'Akun demo perlu dibuat dulu di Supabase atau lewat form daftar.', 'success');
  });
}

function bindAuthLinks() {
  document.getElementById('switchToRegister')?.addEventListener('click', () => setAuthMode('register'));
  document.getElementById('switchToLogin')?.addEventListener('click', () => setAuthMode('login'));
  document.getElementById('forgotPassword')?.addEventListener('click', async () => {
    const email = getEmailValue('loginEmail');

    if (!email) {
      showMessage('loginMessage', 'Isi email terlebih dahulu untuk reset password.', 'error');
      return;
    }

    const { error } = await supabaseClient.auth.resetPasswordForEmail(email);
    showMessage(
      'loginMessage',
      error ? getAuthErrorMessage(error.message) : 'Link reset password dikirim jika email terdaftar.',
      error ? 'error' : 'success',
    );
  });
}

async function initContinueSession() {
  const button = document.getElementById('continueSession');
  if (!button) return;

  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  button.hidden = !session;
  button.addEventListener('click', () => {
    window.location.href = 'dashboard.html';
  });
}

function setAuthMode(mode) {
  const isLogin = mode === 'login';
  document.getElementById('loginTab').classList.toggle('active', isLogin);
  document.getElementById('registerTab').classList.toggle('active', !isLogin);
  document.getElementById('loginForm').classList.toggle('active', isLogin);
  document.getElementById('registerForm').classList.toggle('active', !isLogin);
}

async function ensureProfile(user) {
  if (!user) return;

  const { data } = await supabaseClient
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (data) return;

  const metadata = user.user_metadata || {};
  await upsertProfile({
    id: user.id,
    full_name: metadata.full_name || user.email?.split('@')[0] || 'Pengguna',
    email: user.email,
    gender: metadata.gender || 'male',
    patient_code: metadata.patient_code || makePatientId(),
  });
}

async function upsertProfile(profile) {
  const { error } = await supabaseClient.from('profiles').upsert(profile, {
    onConflict: 'id',
  });

  if (error) throw error;
}

function setFormBusy(formId, busy) {
  const form = document.getElementById(formId);
  form?.querySelectorAll('button, input, select').forEach((element) => {
    element.disabled = busy;
  });
}

function getValue(id) {
  return document.getElementById(id).value.trim();
}

function getEmailValue(id) {
  return getValue(id)
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function showMessage(id, message, type) {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = message;
  element.className = `auth-message ${type}`;
}

function getAuthErrorMessage(message) {
  const text = String(message || '').toLowerCase();

  if (text.includes('invalid login credentials')) return 'Email atau password belum sesuai.';
  if (text.includes('already registered') || text.includes('already been registered')) return 'Email sudah terdaftar.';
  if (text.includes('email not confirmed')) return 'Email belum dikonfirmasi. Cek inbox email Anda.';

  return message || 'Terjadi kesalahan autentikasi.';
}

function makePatientId() {
  return `HD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
}
