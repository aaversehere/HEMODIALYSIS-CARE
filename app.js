'use strict';

const pages = document.querySelectorAll('.page');
const navItems = document.querySelectorAll('.nav-item, .bottom-item');
const pageButtons = document.querySelectorAll('[data-page-target]');
const addNoteButtons = document.querySelectorAll('#addNoteHeader, #addNoteFab');
const fabButton = document.getElementById('addNoteFab');
const themeKey = 'hdc_theme';
const supabaseClient = window.hdcSupabase;
let activeSession = null;
let profileCache = {};
let schedulesCache = [];
let summaryCache = {};
let complaintsCache = [];
let chatReplyTimer = null;

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  activeSession = await requireSession();
  if (!activeSession) return;

  applySession(activeSession);
  bindNavigation();
  await initProfile();
  await initSchedules();
  buildCalendar();
  await initSummaryInputs();
  initCategoryTabs();
  initArticleReader();
  initVideoCards();
  await initComplaints();
  initNoteSearch();
  initNoteActions();
  initLogout();
  initChatbot();
  updateFab('beranda');
});

function initTheme() {
  applyTheme(getSavedTheme());
  document.getElementById('themeToggle')?.addEventListener('click', () => {
    const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(themeKey, nextTheme);
    applyTheme(nextTheme);
  });
}

function getSavedTheme() {
  const savedTheme = localStorage.getItem(themeKey);
  if (savedTheme === 'dark' || savedTheme === 'light') return savedTheme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  const isDark = theme === 'dark';
  const toggle = document.getElementById('themeToggle');

  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  if (!toggle) return;

  toggle.setAttribute('aria-label', isDark ? 'Aktifkan mode siang' : 'Aktifkan mode malam');
  toggle.querySelector('.theme-toggle-text').textContent = isDark ? 'Siang' : 'Malam';
}

async function requireSession() {
  if (!supabaseClient) {
    alert(window.hdcSupabaseError || 'Konfigurasi Supabase belum valid. Cek supabase-config.js.');
    window.location.href = 'index.html';
    return null;
  }

  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (session?.user) {
    const profile = await loadProfile(session.user);
    profileCache = profile;
    return {
      id: session.user.id,
      patientCode: profile.patient_code || session.user.id,
      name: profile.full_name || session.user.email || 'Pengguna',
      email: profile.email || session.user.email || '',
      gender: profile.gender || 'male',
    };
  }

  window.location.href = 'index.html';
  return null;
}

async function loadProfile(user) {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error(error);
  }

  if (data) return data;

  const metadata = user.user_metadata || {};
  const fallback = {
    id: user.id,
    full_name: metadata.full_name || user.email?.split('@')[0] || 'Pengguna',
    email: user.email || '',
    patient_code: metadata.patient_code || makePatientId(),
    gender: metadata.gender || 'male',
  };

  const { data: inserted, error: insertError } = await supabaseClient
    .from('profiles')
    .upsert(fallback, { onConflict: 'id' })
    .select()
    .single();

  if (insertError) {
    console.error(insertError);
    return fallback;
  }

  return inserted;
}

function applySession(session) {
  const firstName = session.name.split(' ')[0] || session.name;

  setText('[data-user-name]', firstName);
  setText('[data-profile-name]', session.name);
  setText('[data-profile-id]', session.patientCode);
  setText('[data-profile-email]', session.email);
  applyAvatar(session.gender);
}

function applyAvatar(gender) {
  const avatar = gender === 'female' ? 'assets/images/user_avatar_female.png' : 'assets/images/user_avatar.png';
  document.querySelectorAll('[data-user-avatar]').forEach((image) => {
    image.src = avatar;
  });
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function getValue(id) {
  return document.getElementById(id)?.value.trim() || '';
}

function makePatientId() {
  return `HD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function bindNavigation() {
  pageButtons.forEach((button) => {
    button.addEventListener('click', () => switchPage(button.dataset.pageTarget));
  });

  addNoteButtons.forEach((button) => {
    button.addEventListener('click', addNote);
  });

  document.getElementById('addScheduleButton')?.addEventListener('click', addSchedule);
  document.getElementById('scheduleForm')?.addEventListener('submit', saveScheduleFromForm);
  document.querySelectorAll('[data-close-schedule]').forEach((button) => {
    button.addEventListener('click', closeScheduleDialog);
  });
  document.getElementById('editProfileButton')?.addEventListener('click', editProfile);
  document.getElementById('completeProfileButton')?.addEventListener('click', editProfile);
  document.getElementById('profileForm')?.addEventListener('submit', saveProfileFromForm);
  document.querySelectorAll('[data-close-profile]').forEach((button) => {
    button.addEventListener('click', closeProfileDialog);
  });
  document.getElementById('complaintForm')?.addEventListener('submit', saveComplaintFromForm);
  document.querySelectorAll('[data-close-complaint]').forEach((button) => {
    button.addEventListener('click', closeComplaintDialog);
  });
}

function switchPage(name) {
  pages.forEach((page) => page.classList.toggle('active', page.id === `page-${name}`));
  navItems.forEach((item) => item.classList.toggle('active', item.dataset.pageTarget === name));
  document.activeElement?.blur();
  updateFab(name);
}

function updateFab(pageName) {
  if (!fabButton) return;
  fabButton.style.display = pageName === 'keluhan' ? 'grid' : 'none';
}

function buildCalendar() {
  const grid = document.getElementById('calGrid');
  if (!grid) return;

  grid.innerHTML = '';

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const today = now.getDate();
  const eventDays = new Set(
    getSchedules()
      .map((schedule) => parseDate(schedule.date))
      .filter((date) => date && date.getFullYear() === year && date.getMonth() === month)
      .map((date) => date.getDate()),
  );

  const title = document.querySelector('.calendar-header strong');
  if (title) {
    title.textContent = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }

  for (let index = 0; index < firstDayIndex; index += 1) {
    grid.appendChild(createCalendarDay('', 'empty'));
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const classes = [];
    if (day < today) classes.push('past');
    if (day === today) classes.push('today');
    if (eventDays.has(day)) classes.push('has-event');
    grid.appendChild(createCalendarDay(day, classes.join(' ')));
  }
}

function initSchedules() {
  return loadSchedules().then(renderSchedules);
}

function getSchedules() {
  return schedulesCache;
}

async function loadSchedules() {
  const { data, error } = await supabaseClient
    .from('schedules')
    .select('*')
    .eq('user_id', activeSession.id)
    .order('schedule_date', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) {
    console.error(error);
    schedulesCache = [];
    return schedulesCache;
  }

  schedulesCache = (data || []).map(mapScheduleFromDb);
  return schedulesCache;
}

function addSchedule() {
  const dialog = document.getElementById('scheduleDialog');
  const form = document.getElementById('scheduleForm');
  const dateInput = document.getElementById('scheduleDate');

  if (!dialog || !form) return;

  form.reset();
  if (dateInput) dateInput.min = new Date().toISOString().slice(0, 10);

  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
}

function closeScheduleDialog() {
  const dialog = document.getElementById('scheduleDialog');
  if (!dialog) return;

  if (typeof dialog.close === 'function') {
    dialog.close();
  } else {
    dialog.removeAttribute('open');
  }
}

async function saveScheduleFromForm(event) {
  event.preventDefault();

  const date = getValue('scheduleDate');
  const start = getValue('scheduleStart');
  const end = getValue('scheduleEnd');
  const place = getValue('schedulePlace');
  const title = getValue('scheduleTitle') || 'Hemodialisis';

  if (start >= end) {
    alert('Jam selesai harus lebih besar dari jam mulai.');
    return;
  }

  const { error } = await supabaseClient.from('schedules').insert({
    user_id: activeSession.id,
    title,
    schedule_date: date,
    start_time: start,
    end_time: end,
    place,
  });

  if (error) {
    alert(`Gagal menyimpan jadwal: ${error.message}`);
    return;
  }

  await loadSchedules();
  renderSchedules();
  buildCalendar();
  closeScheduleDialog();
}

function renderSchedules() {
  const schedules = sortSchedules(getSchedules());
  renderNextSchedule(schedules);
  renderScheduleList(schedules);
  renderStats(schedules);
}

function renderNextSchedule(schedules) {
  const container = document.getElementById('nextSchedule');
  if (!container) return;

  const next = schedules.find((schedule) => !isPastSchedule(schedule)) || schedules[0];

  if (!next) {
    container.innerHTML = '<p class="empty-state">Belum ada jadwal. Tambahkan jadwal dari menu Jadwal.</p>';
    return;
  }

  const date = parseDate(next.date);
  container.innerHTML = `
    <div class="date-pill">
      <span>${escapeHtml(formatWeekday(date, 'long'))}</span>
      <strong>${escapeHtml(formatDay(date))}</strong>
      <small>${escapeHtml(formatMonthYear(date))}</small>
    </div>
    <div class="schedule-detail">
      <p><span class="icon-clock"></span>${escapeHtml(next.start)} - ${escapeHtml(next.end)} WIB</p>
      <p><span class="icon-pin"></span>${escapeHtml(next.place)}</p>
    </div>
  `;
}

function renderScheduleList(schedules) {
  const list = document.getElementById('scheduleList');
  if (!list) return;

  if (!schedules.length) {
    list.innerHTML = '<p class="empty-state">Belum ada jadwal.</p>';
    return;
  }

  list.innerHTML = schedules.map((schedule) => {
    const date = parseDate(schedule.date);
    const isPast = isPastSchedule(schedule);
    return `
      <article class="schedule-item ${isPast ? '' : 'active'}">
        <div class="mini-date ${isPast ? 'muted' : ''}">
          <span>${escapeHtml(formatWeekday(date, 'short'))}</span>
          <strong>${escapeHtml(formatDay(date))}</strong>
        </div>
        <div>
          <h3>${escapeHtml(schedule.title)}</h3>
          <p>${escapeHtml(schedule.start)} - ${escapeHtml(schedule.end)} WIB</p>
          <p>${escapeHtml(schedule.place)}</p>
        </div>
        <span class="pill ${isPast ? 'neutral' : 'success'}">${isPast ? 'Selesai' : 'Mendatang'}</span>
      </article>
    `;
  }).join('');
}

function sortSchedules(schedules) {
  return [...schedules].sort((a, b) => {
    const dateA = parseDate(a.date)?.getTime() || 0;
    const dateB = parseDate(b.date)?.getTime() || 0;
    return dateA - dateB;
  });
}

function mapScheduleFromDb(row) {
  return {
    id: row.id,
    date: row.schedule_date,
    start: formatTimeValue(row.start_time),
    end: formatTimeValue(row.end_time),
    place: row.place,
    title: row.title,
    status: row.status,
  };
}

function formatTimeValue(value) {
  return String(value || '').slice(0, 5);
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isPastSchedule(schedule) {
  const date = parseDate(schedule.date);
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

function formatWeekday(date, style) {
  if (!date) return '';
  return date.toLocaleDateString('id-ID', { weekday: style });
}

function formatDay(date) {
  if (!date) return '';
  return String(date.getDate());
}

function formatMonthYear(date) {
  if (!date) return '';
  return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

function createCalendarDay(content, className) {
  const day = document.createElement('span');
  day.className = `cal-day ${className}`.trim();
  day.textContent = content;
  return day;
}

async function initSummaryInputs() {
  const inputs = document.querySelectorAll('[data-summary-field]');
  const summary = await loadSummary();

  inputs.forEach((input) => {
    input.value = summary[input.dataset.summaryField] || '';
    input.addEventListener('input', async () => {
      const current = getSummary();
      current[input.dataset.summaryField] = input.value.trim();
      renderSummary(current);
      await saveSummary(current);
    });
  });

  renderSummary(summary);
}

function getSummary() {
  return summaryCache;
}

async function loadSummary() {
  const { data, error } = await supabaseClient
    .from('daily_summaries')
    .select('*')
    .eq('user_id', activeSession.id)
    .eq('summary_date', getTodayKey())
    .maybeSingle();

  if (error) {
    console.error(error);
  }

  summaryCache = data ? mapSummaryFromDb(data) : {};
  return summaryCache;
}

async function saveSummary(summary) {
  summaryCache = summary;

  const { error } = await supabaseClient.from('daily_summaries').upsert(
    {
      user_id: activeSession.id,
      summary_date: getTodayKey(),
      weight: toNullableNumber(summary.weight),
      systolic: toNullableInteger(summary.systolic),
      diastolic: toNullableInteger(summary.diastolic),
      fluid_ml: toNullableInteger(summary.fluid),
      medicine_count: toNullableInteger(summary.medicine),
    },
    { onConflict: 'user_id,summary_date' },
  );

  if (error) console.error(error);
}

function renderSummary(summary) {
  renderWeight(summary.weight);
  renderBloodPressure(summary.systolic, summary.diastolic);
  renderFluid(summary.fluid);
  renderMedicine(summary.medicine);
}

function renderWeight(weight) {
  const text = document.querySelector('[data-summary-text="weight"]');
  if (!text) return;

  text.textContent = weight ? 'Data berat badan tersimpan.' : 'Belum ada data berat badan.';
  text.classList.toggle('success-text', Boolean(weight));
}

function renderBloodPressure(systolic, diastolic) {
  const text = document.querySelector('[data-summary-text="bloodPressure"]');
  if (!text) return;

  if (!systolic || !diastolic) {
    text.textContent = 'Belum ada data tekanan darah.';
    text.classList.remove('success-text', 'danger');
    return;
  }

  const high = Number(systolic) >= 140 || Number(diastolic) >= 90;
  text.textContent = high ? 'Perlu dipantau, tekanan cukup tinggi.' : 'Data tekanan darah tersimpan.';
  text.classList.toggle('danger', high);
  text.classList.toggle('success-text', !high);
}

function renderFluid(fluid) {
  const text = document.querySelector('[data-summary-text="fluid"]');
  const bar = document.querySelector('[data-summary-progress="fluid"]');
  const dailyLimit = 2000;

  if (!text || !bar) return;

  if (!fluid) {
    text.textContent = 'Belum ada data cairan.';
    text.classList.remove('success-text', 'danger');
    bar.style.width = '0%';
    return;
  }

  const percent = Math.min(Math.round((Number(fluid) / dailyLimit) * 100), 100);
  text.textContent = `${percent}% dari batas harian`;
  text.classList.toggle('danger', percent >= 80);
  text.classList.toggle('success-text', percent < 80);
  bar.style.width = `${percent}%`;
}

function renderMedicine(medicine) {
  const text = document.querySelector('[data-summary-text="medicine"]');
  if (!text) return;

  text.textContent = medicine ? 'Data obat tersimpan.' : 'Belum ada data obat.';
  text.classList.toggle('success-text', Boolean(medicine));
}

function mapSummaryFromDb(row) {
  return {
    weight: row.weight ?? '',
    systolic: row.systolic ?? '',
    diastolic: row.diastolic ?? '',
    fluid: row.fluid_ml ?? '',
    medicine: row.medicine_count ?? '',
  };
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function toNullableNumber(value) {
  return value === '' || value == null ? null : Number(value);
}

function toNullableInteger(value) {
  return value === '' || value == null ? null : parseInt(value, 10);
}

function initProfile() {
  renderProfile(getProfile());
}

function getProfile() {
  return {
    birthDate: profileCache.birth_date || '',
    phone: profileCache.phone || '',
    address: profileCache.address || '',
  };
}

async function saveProfile(profile) {
  const { data, error } = await supabaseClient
    .from('profiles')
    .update({
      birth_date: profile.birthDate || null,
      phone: profile.phone || null,
      address: profile.address || null,
    })
    .eq('id', activeSession.id)
    .select()
    .single();

  if (error) {
    alert(`Gagal menyimpan profil: ${error.message}`);
    return false;
  }

  profileCache = data;
  return true;
}

function editProfile() {
  const current = getProfile();
  const dialog = document.getElementById('profileDialog');

  setFormValue('profileBirthDate', current.birthDate || '');
  setFormValue('profilePhone', current.phone || '');
  setFormValue('profileAddress', current.address || '');

  if (!dialog) return;

  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
}

async function saveProfileFromForm(event) {
  event.preventDefault();

  const profile = {
    birthDate: getValue('profileBirthDate'),
    phone: getValue('profilePhone'),
    address: getValue('profileAddress'),
  };
  const saved = await saveProfile(profile);
  if (!saved) return;
  renderProfile(profile);
  closeProfileDialog();
}

function closeProfileDialog() {
  const dialog = document.getElementById('profileDialog');
  if (!dialog) return;

  if (typeof dialog.close === 'function') {
    dialog.close();
  } else {
    dialog.removeAttribute('open');
  }
}

function setFormValue(id, value) {
  const element = document.getElementById(id);
  if (element) element.value = value;
}

function renderProfile(profile) {
  setText('[data-profile-birth]', profile.birthDate || '');
  setText('[data-profile-phone]', profile.phone || '');
  setText('[data-profile-address]', profile.address || '');
}

function renderStats(schedules) {
  setText('[data-total-sessions]', String(schedules.length));
  setText('[data-active-months]', schedules.length ? String(countActiveMonths(schedules)) : '0');
  setText('[data-adherence]', schedules.length ? '100%' : '-');
}

function countActiveMonths(schedules) {
  const months = new Set(
    schedules
      .map((schedule) => parseDate(schedule.date))
      .filter(Boolean)
      .map((date) => `${date.getFullYear()}-${date.getMonth()}`),
  );
  return months.size;
}

function initCategoryTabs() {
  const tabs = document.querySelectorAll('.category-tabs button');
  const articles = document.querySelectorAll('.article-item');
  const videos = document.querySelectorAll('.video-card');
  const educationContent = document.getElementById('educationContent');
  const videoEducationPage = document.getElementById('videoEducationPage');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((item) => item.classList.remove('active'));
      tab.classList.add('active');

      const category = tab.dataset.educationFilter || tab.textContent.trim();
      updateFeaturedEducation(category);

      const videoMode = category === 'Video';
      if (educationContent) educationContent.hidden = videoMode;
      if (videoEducationPage) videoEducationPage.hidden = !videoMode;

      articles.forEach((article) => {
        const shouldShow = category === 'Semua' || article.dataset.category === category;
        article.style.display = shouldShow ? 'grid' : 'none';
      });

      videos.forEach((video) => {
        const shouldShow = category === 'Semua' || videoMode || video.dataset.category === category;
        video.style.display = shouldShow ? 'grid' : 'none';
      });
    });
  });

  updateFeaturedEducation('Semua');
  if (videoEducationPage) videoEducationPage.hidden = true;
}

function updateFeaturedEducation(category) {
  const featured = {
    Semua: {
      category: 'Semua',
      image: 'assets/images/healthy_food.png',
      alt: 'Gabungan edukasi diet olahraga dan obat',
      title: 'Edukasi lengkap untuk perawatan harian',
      text: 'Lihat panduan diet, olahraga ringan, dan obat agar rutinitas hemodialisis lebih tertata.',
    },
    Diet: {
      category: 'Diet',
      image: 'assets/images/healthy_food.png',
      alt: 'Makanan sehat untuk diet pasien ginjal',
      title: 'Pilihan makanan untuk diet pasien ginjal',
      text: 'Kenali pilihan makanan yang lebih aman untuk membantu menjaga asupan harian.',
    },
    Olahraga: {
      category: 'Olahraga',
      image: 'assets/images/exercise_care.png',
      alt: 'Olahraga ringan untuk pasien hemodialisis',
      title: 'Olahraga ringan yang aman dilakukan',
      text: 'Gerakan ringan dapat membantu tubuh tetap aktif, sesuai kondisi dan arahan tenaga kesehatan.',
    },
    Obat: {
      category: 'Obat',
      image: 'assets/images/medicine_care.png',
      alt: 'Pengingat obat pasien hemodialisis',
      title: 'Cara mengatur jadwal minum obat',
      text: 'Catat obat dan ikuti dosis yang diberikan dokter agar penggunaan obat lebih teratur.',
    },
    Video: {
      category: 'Video Edukasi',
      image: 'assets/images/healthy_food.png',
      alt: 'Video edukasi hemodialisis',
      title: 'Kumpulan video edukasi pasien',
      text: 'Tonton materi video tentang diet, olahraga ringan, dan obat untuk membantu perawatan harian.',
    },
  };

  const content = featured[category] || featured.Semua;
  const card = document.getElementById('featuredEducation');
  const image = document.getElementById('featuredEducationImage');

  card?.classList.toggle('combo-mode', category === 'Semua' || category === 'Video');

  if (image) {
    image.src = content.image;
    image.alt = content.alt;
  }

  setText('#featuredEducationCategory', content.category);
  setText('#featuredEducationTitle', content.title);
  setText('#featuredEducationText', content.text);
}

function initArticleReader() {
  document.getElementById('articleList')?.addEventListener('click', (event) => {
    const article = event.target.closest('[data-article-src]');
    if (!article) return;

    openArticleDialog({
      src: article.dataset.articleSrc,
      title: article.dataset.articleTitle || article.querySelector('strong')?.textContent || 'Artikel Edukasi',
    });
  });

  document.getElementById('closeArticleDialog')?.addEventListener('click', closeArticleDialog);
  document.getElementById('articleDialog')?.addEventListener('close', () => {
    const viewer = document.getElementById('articleViewer');
    if (viewer) viewer.removeAttribute('src');
  });
}

function openArticleDialog({ src, title }) {
  const dialog = document.getElementById('articleDialog');
  const viewer = document.getElementById('articleViewer');
  const heading = document.getElementById('articleDialogTitle');

  if (!dialog || !viewer || !src) return;

  if (heading) heading.textContent = title;
  viewer.src = src;

  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
}

function closeArticleDialog() {
  const dialog = document.getElementById('articleDialog');
  if (!dialog) return;

  if (typeof dialog.close === 'function') {
    dialog.close();
  } else {
    const viewer = document.getElementById('articleViewer');
    if (viewer) viewer.removeAttribute('src');
    dialog.removeAttribute('open');
  }
}

function initNoteSearch() {
  const input = document.getElementById('catatanSearch');
  if (!input) return;

  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();
    document.querySelectorAll('.note-card').forEach((card) => {
      card.style.display = card.textContent.toLowerCase().includes(query) ? '' : 'none';
    });
  });
}

async function initComplaints() {
  await loadComplaints();
  renderComplaints();
}

async function loadComplaints() {
  const { data, error } = await supabaseClient
    .from('complaints')
    .select('*, complaint_tags(tag)')
    .eq('user_id', activeSession.id)
    .order('complaint_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    complaintsCache = [];
    return complaintsCache;
  }

  complaintsCache = (data || []).map(mapComplaintFromDb);
  return complaintsCache;
}

function renderComplaints() {
  const list = document.getElementById('catatanList');
  if (!list) return;

  if (!complaintsCache.length) {
    list.innerHTML = '<p class="empty-state">Belum ada keluhan. Tekan tombol tambah untuk mencatat keluhan.</p>';
    return;
  }

  list.innerHTML = complaintsCache.map((complaint) => `
    <article class="note-card ${escapeHtml(complaint.color)}" data-complaint-id="${escapeHtml(complaint.id)}">
      <div class="note-top">
        <span>${escapeHtml(formatDisplayDate(complaint.date))}</span>
        <button type="button" class="delete-note" aria-label="Hapus keluhan">&times;</button>
      </div>
      <h3>${escapeHtml(complaint.title)}</h3>
      <p>${escapeHtml(complaint.body)}</p>
      <div class="tags">${complaint.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
    </article>
  `).join('');
}

function mapComplaintFromDb(row) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    color: row.color,
    date: row.complaint_date,
    tags: (row.complaint_tags || []).map((item) => item.tag),
  };
}

function initNoteActions() {
  document.getElementById('catatanList')?.addEventListener('click', (event) => {
    const button = event.target.closest('.delete-note');
    if (button) deleteNote(button);
  });
}

function initLogout() {
  document.getElementById('logoutButton')?.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
  });
}

function initChatbot() {
  document.getElementById('openChatbot')?.addEventListener('click', openChatbot);
  document.getElementById('closeChatbot')?.addEventListener('click', closeChatbot);
  document.getElementById('chatbotForm')?.addEventListener('submit', sendChatMessage);
  renderChatMessages(getChatMessages());
}

function openChatbot() {
  const panel = document.getElementById('chatbotPanel');
  if (!panel) return;

  const toggle = document.getElementById('openChatbot');
  toggle?.classList.remove('is-opening');
  toggle?.offsetWidth;
  toggle?.classList.add('is-opening');
  window.setTimeout(() => toggle?.classList.remove('is-opening'), 560);

  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');

  const messages = getChatMessages();
  if (!messages.length) {
    saveChatMessages([
      {
        role: 'bot',
        text: 'Halo, saya Asisten Care. Saya bisa membantu informasi umum tentang jadwal, cairan, obat, tekanan darah, dan keluhan harian.',
      },
    ]);
    renderChatMessages(getChatMessages());
  }

  document.getElementById('chatbotInput')?.focus();
}

function closeChatbot() {
  const panel = document.getElementById('chatbotPanel');
  if (!panel) return;

  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
}

function sendChatMessage(event) {
  event.preventDefault();

  const input = document.getElementById('chatbotInput');
  const submitButton = document.querySelector('#chatbotForm button[type="submit"]');
  const text = input?.value.trim();
  if (!text) return;

  const messages = getChatMessages();
  messages.push({ role: 'user', text });

  saveChatMessages(messages.slice(-30));
  renderChatMessages(getChatMessages());
  input.value = '';

  window.clearTimeout(chatReplyTimer);
  input.disabled = true;
  if (submitButton) submitButton.disabled = true;
  showChatTyping();

  chatReplyTimer = window.setTimeout(() => {
    const updatedMessages = getChatMessages();
    updatedMessages.push({ role: 'bot', text: getBotReply(text) });
    saveChatMessages(updatedMessages.slice(-30));
    renderChatMessages(getChatMessages());
    input.disabled = false;
    if (submitButton) submitButton.disabled = false;
    input.focus();
  }, getChatReplyDelay(text));
}

function showChatTyping() {
  const container = document.getElementById('chatbotMessages');
  if (!container) return;

  container.insertAdjacentHTML('beforeend', `
    <div class="chat-message bot typing" aria-label="Asisten sedang mengetik">
      <span></span>
      <span></span>
      <span></span>
    </div>
  `);
  container.scrollTop = container.scrollHeight;
}

function getChatReplyDelay(message) {
  return Math.min(1800, Math.max(750, message.length * 28));
}

function getChatMessages() {
  try {
    return JSON.parse(localStorage.getItem(getChatKey())) || [];
  } catch {
    return [];
  }
}

function saveChatMessages(messages) {
  localStorage.setItem(getChatKey(), JSON.stringify(messages));
}

function getChatKey() {
  return `hdc_chat_${activeSession?.id || 'guest'}`;
}

function renderChatMessages(messages) {
  const container = document.getElementById('chatbotMessages');
  if (!container) return;

  container.innerHTML = messages.map((message) => `
    <div class="chat-message ${message.role === 'user' ? 'user' : 'bot'}">
      ${escapeHtml(message.text)}
    </div>
  `).join('');
  container.scrollTop = container.scrollHeight;
}

function getBotReply(message) {
  const text = message.toLowerCase();

  if (hasAny(text, ['halo', 'hallo', 'hello', 'hai', 'hi', 'pagi', 'siang', 'sore', 'malam'])) {
    return 'Halo. Ceritakan keluhan yang Anda rasakan, misalnya pusing, mual, kram, lemas, gatal, bengkak, sesak, atau keluhan setelah hemodialisis. Saya akan bantu beri arahan umum.';
  }

  if (hasAny(text, ['sesak', 'nyeri dada', 'dada sakit', 'pingsan', 'darurat', 'emergency', 'kejang', 'tidak sadar', 'perdarahan'])) {
    return 'Ini termasuk tanda bahaya. Jika keluhannya berat, tiba-tiba, atau disertai lemas sekali, segera hubungi keluarga, perawat/dokter, atau layanan gawat darurat terdekat. Jangan menunggu sampai jadwal kontrol berikutnya.';
  }

  if (hasAny(text, ['pusing', 'kepala berputar', 'kepala sakit', 'sakit kepala', 'kunang', 'mau jatuh'])) {
    return 'Pusing bisa terjadi karena tekanan darah turun/naik, kurang makan, perubahan cairan, atau efek setelah dialisis. Coba duduk atau berbaring dulu, ukur tekanan darah bila ada alat, minum/makan sesuai batas yang dianjurkan, lalu catat di menu Keluhan. Jika pusing berat, pingsan, atau disertai nyeri dada/sesak, segera hubungi tenaga medis.';
  }

  if (hasAny(text, ['mual', 'muntah', 'enek', 'tidak nafsu makan', 'perut tidak enak'])) {
    return 'Mual bisa dipengaruhi makanan, obat, tekanan darah, atau kondisi setelah dialisis. Coba makan porsi kecil, hindari makanan yang memicu mual, dan catat kapan mual muncul. Jika muntah terus, tidak bisa makan/minum, atau badan sangat lemas, sebaiknya hubungi dokter/perawat.';
  }

  if (hasAny(text, ['kram', 'kaki kram', 'otot kram', 'kesemutan'])) {
    return 'Kram cukup sering terjadi pada pasien hemodialisis, terutama terkait perubahan cairan. Istirahatkan bagian yang kram dan lakukan peregangan ringan bila aman. Jangan memijat terlalu keras. Jika sering terjadi saat/ setelah dialisis, catat waktunya dan sampaikan ke perawat agar pengaturan cairan bisa dievaluasi.';
  }

  if (hasAny(text, ['lemas', 'capek', 'letih', 'lesu', 'tidak bertenaga', 'badan lemah'])) {
    return 'Lemas bisa berhubungan dengan tekanan darah, anemia, kurang makan, tidur, atau efek setelah dialisis. Coba istirahat, makan sesuai anjuran, dan cek tekanan darah bila memungkinkan. Jika lemas sangat berat, tampak pucat, sesak, nyeri dada, atau hampir pingsan, segera minta bantuan medis.';
  }

  if (hasAny(text, ['bengkak', 'kaki bengkak', 'wajah bengkak', 'perut bengkak', 'berat naik'])) {
    return 'Bengkak atau berat badan naik cepat bisa menandakan penumpukan cairan. Catat berat badan, jumlah cairan harian, dan lokasi bengkak. Ikuti batas cairan dari dokter/perawat. Jika bengkak disertai sesak napas, segera cari bantuan medis.';
  }

  if (hasAny(text, ['gatal', 'kulit gatal', 'ruam', 'kering'])) {
    return 'Gatal pada pasien ginjal bisa terjadi karena kulit kering atau faktor lain yang perlu dievaluasi. Hindari menggaruk kuat, gunakan pelembap yang aman bila biasa dipakai, dan catat kapan gatal muncul. Jika ada luka, ruam berat, bernanah, atau demam, hubungi tenaga medis.';
  }

  if (hasAny(text, ['demam', 'panas', 'menggigil', 'meriang'])) {
    return 'Demam atau menggigil perlu diperhatikan, terutama bila ada akses dialisis. Ukur suhu bila bisa, cukup istirahat, dan hubungi dokter/perawat jika demam menetap, menggigil berat, atau area akses dialisis merah, nyeri, bengkak, atau keluar cairan.';
  }

  if (hasAny(text, ['akses', 'fistula', 'cimino', 'kateter', 'bekas tusukan', 'berdarah'])) {
    return 'Jaga area akses dialisis tetap bersih dan jangan ditekan sembarangan. Jika ada perdarahan yang sulit berhenti, nyeri hebat, bengkak, kemerahan, panas, atau keluar cairan, segera hubungi fasilitas kesehatan.';
  }

  if (hasAny(text, ['setelah dialisis', 'habis dialisis', 'habis cuci darah', 'selesai dialisis'])) {
    return 'Setelah dialisis, keluhan seperti lemas, pusing, kram, atau mual bisa muncul. Istirahat dulu, bangun perlahan, dan catat keluhan beserta waktunya. Jika keluhan berat atau berulang setiap sesi, sampaikan ke perawat/dokter saat jadwal berikutnya.';
  }

  if (hasAny(text, ['jadwal', 'hemodialisis', 'dialisis', 'cuci darah'])) {
    return 'Untuk menambah jadwal, buka menu Jadwal lalu tekan Tambah +. Jadwal yang disimpan akan muncul di Beranda dan kalender.';
  }

  if (hasAny(text, ['cairan', 'minum', 'haus'])) {
    return 'Catat jumlah cairan harian di Ringkasan Hari Ini. Ikuti batas cairan yang diberikan dokter atau perawat, karena kebutuhan tiap pasien bisa berbeda.';
  }

  if (hasAny(text, ['obat', 'minum obat', 'lupa obat'])) {
    return 'Gunakan bagian Obat untuk mencatat jumlah obat. Jika lupa minum obat atau ragu dosisnya, tanyakan ke dokter, perawat, atau apoteker.';
  }

  if (hasAny(text, ['tekanan darah', 'darah', 'tensi', 'mmhg'])) {
    return 'Masukkan tekanan darah sistolik dan diastolik di Ringkasan Hari Ini. Jika hasil sangat tinggi, sangat rendah, atau disertai keluhan, segera konsultasikan ke tenaga medis.';
  }

  if (hasAny(text, ['berat', 'berat badan', 'kg'])) {
    return 'Catat berat badan secara rutin, terutama sebelum dan sesudah dialisis jika diarahkan petugas. Perubahan mendadak sebaiknya dikonsultasikan.';
  }

  if (hasAny(text, ['makan', 'diet', 'kalium', 'garam', 'protein'])) {
    return 'Untuk edukasi makanan, buka menu Edukasi. Pilihan makanan pasien ginjal sebaiknya mengikuti anjuran dokter atau ahli gizi.';
  }

  if (hasAny(text, ['catatan', 'note', 'keluhan'])) {
    return 'Anda bisa menulis keluhan di menu Keluhan agar mudah dipantau kembali. Tulis gejalanya, kapan muncul, seberapa berat, dan apakah terjadi sebelum atau setelah dialisis.';
  }

  if (hasAny(text, ['profil', 'alamat', 'telepon', 'tanggal lahir'])) {
    return 'Data pribadi dapat diisi dari menu Profil dengan menekan tombol edit di kanan atas.';
  }

  return 'Saya belum sepenuhnya memahami. Coba ceritakan keluhannya lebih jelas, misalnya: bagian tubuh yang sakit, sejak kapan, ringan atau berat, dan apakah terjadi sebelum atau setelah dialisis. Jika terasa darurat, segera hubungi tenaga medis.';
}

function hasAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function initVideoCards() {
  document.getElementById('closeVideoDialog')?.addEventListener('click', closeVideoDialog);
  document.getElementById('videoDialog')?.addEventListener('close', stopVideoDialog);

  document.getElementById('videoList')?.addEventListener('click', (event) => {
    const actionButton = event.target.closest('[data-video-action]');
    const playButton = event.target.closest('.play-button');
    const card = event.target.closest('.video-card');

    if (!card) return;

    if (playButton) {
      const video = card.querySelector('video');
      const source = video?.querySelector('source');
      const videoUrl = card.dataset.videoUrl || source?.getAttribute('src') || '';

      if (videoUrl) {
        openVideoDialog({
          src: videoUrl,
          poster: video.getAttribute('poster') || '',
          title: card.querySelector('h3')?.textContent || 'Video Edukasi',
        });
      } else {
        playButton.textContent = 'VIDEO BELUM ADA';
        setTimeout(() => {
          playButton.textContent = 'PLAY';
        }, 1200);
      }
      return;
    }

    if (!actionButton) return;

    const action = actionButton.dataset.videoAction;
    if (action === 'watched') {
      card.classList.toggle('watched');
      const status = card.querySelector('.watch-status');
      const active = card.classList.contains('watched');
      if (status) status.textContent = active ? 'Sudah ditonton' : 'Belum ditonton';
      actionButton.textContent = active ? 'Batalkan ditonton' : 'Tandai ditonton';
    }

    if (action === 'favorite') {
      card.classList.toggle('favorite');
      const status = card.querySelector('.favorite-status');
      const active = card.classList.contains('favorite');
      if (status) status.textContent = active ? 'Favorite' : 'Belum favorite';
      actionButton.textContent = active ? 'Hapus favorite' : 'Favorite';
    }
  });
}

function openVideoDialog({ src, poster, title }) {
  const dialog = document.getElementById('videoDialog');
  const player = document.getElementById('videoDialogPlayer');
  const frame = document.getElementById('videoDialogFrame');
  const heading = document.getElementById('videoDialogTitle');

  if (!dialog || !player || !frame) return;

  if (heading) heading.textContent = title;

  const embedUrl = getEmbeddableVideoUrl(src);
  const useFrame = isFrameVideoUrl(embedUrl);

  if (useFrame && window.location.protocol === 'file:') {
    window.open(src, '_blank', 'noopener');
    return;
  }

  player.hidden = useFrame;
  frame.hidden = !useFrame;

  if (useFrame) {
    player.pause();
    player.removeAttribute('src');
    frame.src = embedUrl;
  } else {
    frame.removeAttribute('src');
    player.src = embedUrl;
    player.poster = poster;
    player.load();
  }

  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }

  if (!useFrame) player.play().catch(() => {});
}

function closeVideoDialog() {
  const dialog = document.getElementById('videoDialog');
  if (!dialog) return;

  if (typeof dialog.close === 'function') {
    dialog.close();
  } else {
    stopVideoDialog();
    dialog.removeAttribute('open');
  }
}

function stopVideoDialog() {
  const player = document.getElementById('videoDialogPlayer');
  const frame = document.getElementById('videoDialogFrame');
  if (!player) return;

  player.pause();
  player.removeAttribute('src');
  player.load();
  frame?.removeAttribute('src');
}

function getEmbeddableVideoUrl(src) {
  if (!src) return '';

  try {
    const url = new URL(src);

    if (url.hostname.includes('youtu.be')) {
      const videoId = url.pathname.replace('/', '');
      return `https://www.youtube.com/embed/${videoId}`;
    }

    if (url.hostname.includes('youtube.com')) {
      const videoId = url.searchParams.get('v');
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    }

    return url.href;
  } catch {
    return src;
  }
}

function isFrameVideoUrl(src) {
  try {
    const url = new URL(src);
    return url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be') || url.hostname.includes('vimeo.com');
  } catch {
    return false;
  }
}

function addNote() {
  const dialog = document.getElementById('complaintDialog');
  const form = document.getElementById('complaintForm');
  if (!dialog || !form) return;

  form.reset();

  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
}

async function saveComplaintFromForm(event) {
  event.preventDefault();

  const title = getValue('complaintTitle');
  const body = getValue('complaintBody');
  const rawTags = getValue('complaintTags');
  const color = ['green', 'blue', 'purple'][Math.floor(Math.random() * 3)];
  const tags = rawTags
    ? rawTags.split(',').map((tag) => tag.trim()).filter(Boolean)
    : ['Keluhan Baru'];

  const { data, error } = await supabaseClient
    .from('complaints')
    .insert({
      user_id: activeSession.id,
      title,
      body,
      color,
      complaint_date: getTodayKey(),
    })
    .select()
    .single();

  if (error) {
    alert(`Gagal menyimpan keluhan: ${error.message}`);
    return;
  }

  if (tags.length) {
    const { error: tagError } = await supabaseClient.from('complaint_tags').insert(
      tags.map((tag) => ({
        complaint_id: data.id,
        tag,
      })),
    );

    if (tagError) {
      alert(`Keluhan tersimpan, tapi tag gagal disimpan: ${tagError.message}`);
    }
  }

  await loadComplaints();
  renderComplaints();
  closeComplaintDialog();
}

function formatDisplayDate(value) {
  const date = parseDate(value);
  if (!date) return '';
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function closeComplaintDialog() {
  const dialog = document.getElementById('complaintDialog');
  if (!dialog) return;

  if (typeof dialog.close === 'function') {
    dialog.close();
  } else {
    dialog.removeAttribute('open');
  }
}

async function deleteNote(button) {
  const card = button.closest('.note-card');
  if (!card) return;

  const complaintId = card.dataset.complaintId;
  if (complaintId) {
    const { error } = await supabaseClient.from('complaints').delete().eq('id', complaintId);
    if (error) {
      alert(`Gagal menghapus keluhan: ${error.message}`);
      return;
    }
  }

  card.animate(
    [
      { opacity: 1, transform: 'translateX(0)' },
      { opacity: 0, transform: 'translateX(18px)' },
    ],
    { duration: 220, easing: 'ease' },
  ).onfinish = () => card.remove();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
