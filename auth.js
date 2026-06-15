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
      const { data: sessionData, error: sessionError } = await runSupabaseRequest(() => supabaseClient.auth.getSession());
      if (sessionError) {
        showMessage('loginMessage', getAuthErrorMessage(sessionError.message), 'error');
        return;
      }

      if (sessionData.session) {
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

    const { data, error } = await runSupabaseRequest(() => supabaseClient.auth.signInWithPassword({
      email,
      password,
    }));

    if (error) {
      setFormBusy('loginForm', false);
      showMessage('loginMessage', getAuthErrorMessage(error.message), 'error');
      return;
    }

    try {
      await ensureProfile(data.user);
    } catch (error) {
      setFormBusy('loginForm', false);
      showMessage('loginMessage', getAuthErrorMessage(error.message), 'error');
      return;
    }

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
    const { data, error } = await runSupabaseRequest(() => supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          gender,
          patient_code: patientCode,
        },
      },
    }));

    if (error) {
      setFormBusy('registerForm', false);
      showMessage('registerMessage', getAuthErrorMessage(error.message), 'error');
      return;
    }

    if (data.user && data.session) {
      try {
        await upsertProfile({
          id: data.user.id,
          full_name: name,
          email,
          gender,
          patient_code: patientCode,
        });
      } catch (error) {
        setFormBusy('registerForm', false);
        showMessage('registerMessage', getAuthErrorMessage(error.message), 'error');
        return;
      }
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

    const { error } = await runSupabaseRequest(() => supabaseClient.auth.resetPasswordForEmail(email));
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

  const { data, error } = await runSupabaseRequest(() => supabaseClient.auth.getSession());
  if (error) return;

  button.hidden = !data.session;
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

  if (text.includes('failed to fetch') || text.includes('networkerror') || text.includes('load failed')) {
    return 'Tidak bisa terhubung ke Supabase. Cek URL dan anon key project baru di supabase-config.js, pastikan internet aktif, lalu refresh halaman.';
  }

  if (text.includes('invalid api key') || text.includes('jwt')) {
    return 'Anon key Supabase belum sesuai. Copy ulang anon public key dari project Supabase baru.';
  }

  if (text.includes('relation') && text.includes('does not exist')) {
    return 'Tabel database belum ada. Jalankan file SQL migration di Supabase SQL Editor terlebih dahulu.';
  }

  if (text.includes('invalid login credentials')) return 'Email atau password belum sesuai.';
  if (text.includes('already registered') || text.includes('already been registered')) return 'Email sudah terdaftar.';
  if (text.includes('email not confirmed')) return 'Email belum dikonfirmasi. Cek inbox email Anda.';

  return message || 'Terjadi kesalahan autentikasi.';
}

async function runSupabaseRequest(request) {
  try {
    return await request();
  } catch (error) {
    return {
      data: null,
      error: {
        message: error?.message || 'Tidak bisa terhubung ke Supabase.',
      },
    };
  }
}

function makePatientId() {
  return `HD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
}
