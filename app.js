// app.js

const firebaseConfig = {
  apiKey: "AIzaSyCIZh1f8URc2UpMWlQtCDlGpH5M2B44k5E",
  authDomain: "animelist-18757.firebaseapp.com",
  projectId: "animelist-18757",
  storageBucket: "animelist-18757.firebasestorage.app",
  messagingSenderId: "408542749866",
  appId: "1:408542749866:web:0b2f46af95d83c67609cd3",
  measurementId: "G-0YV88WDJJN"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// === FRIENDLY ERROR MESSAGES ===
function getFriendlyMsg(error) {
    console.log("Error Code:", error.code); 
    switch (error.code) {
        case 'auth/account-exists-with-different-credential':
            return "Account exists with a different method (e.g., Password vs Google). Please login the other way.";
        case 'auth/invalid-credential':
        case 'auth/user-not-found':
        case 'auth/wrong-password':
            return "Incorrect email or password.";
        case 'auth/email-already-in-use':
            return "Email already taken! Please use a different one.";
        case 'auth/weak-password':
            return "Password too weak (6+ chars).";
        case 'auth/invalid-email':
            return "Invalid email address.";
        case 'auth/too-many-requests':
            return "Too many attempts. Wait a bit.";
        case 'auth/requires-recent-login':
            return "Security: Please Log Out and Log In again to do this.";
        case 'auth/credential-already-in-use':
            return "This account is already linked to another user.";
        default:
            return error.message; 
    }
}

// === TOAST SYSTEM ===
function showToast(msg, type = 'info') {
    const color = type === 'success' ? "#22c55e" : type === 'error' ? "#ef4444" : "#3b82f6";
    if (typeof Toastify === 'function') {
        Toastify({ text: msg, duration: 3000, gravity: "top", position: "center", backgroundColor: color, stopOnFocus: true }).showToast();
    } else { console.log(msg); }
}

// === AUTH STATE ===
auth.onAuthStateChanged(user => {
    const path = window.location.pathname;
    const isProtectedPage = path.includes('home.html') || path.includes('discover.html') || path.includes('mylist.html') || path.includes('account.html');
    
    const isVerified = user && (user.emailVerified || user.isAnonymous || user.providerData.length > 0);

    if (isVerified) {
        if (isProtectedPage) {
            updateUserDisplay(user);
            if (path.includes('home.html')) initHomePage();
            if (path.includes('discover.html')) initDiscoverPage();
            if (path.includes('mylist.html')) initMyListPage();
            if (path.includes('account.html')) initAccountPage(user);
        }
    } else {
        if (isProtectedPage) window.location.href = 'index.html';
    }
});

function updateUserDisplay(user) {
    const nameDisplay = document.getElementById('user-display');
    const mobileAvatars = document.querySelectorAll('.nav-avatar-mobile');
    
    let name = "Guest";
    let photo = "default.png";

    if (!user.isAnonymous) {
        name = user.displayName || user.email.split('@')[0];
        if (user.photoURL) photo = user.photoURL;
    }

    // Update PC Name
    if (nameDisplay) nameDisplay.textContent = name;

    // Update Mobile Avatar (All instances)
    mobileAvatars.forEach(img => {
        img.src = photo;
        img.onclick = () => window.location.href = 'account.html'; // Ensure click works
    });
}

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) logoutBtn.addEventListener('click', () => auth.signOut().then(() => window.location.href = 'index.html'));

// === ACCOUNT PAGE LOGIC ===
async function initAccountPage(user) {
    const isGuest = user.isAnonymous;

    const bindSection = document.getElementById('guest-bind-section');
    const emailSection = document.getElementById('email-update-section');
    const guestBadge = document.getElementById('guest-badge');

    if(bindSection) bindSection.style.display = isGuest ? 'block' : 'none';
    if(emailSection) emailSection.style.display = isGuest ? 'none' : 'block';
    if(guestBadge) guestBadge.style.display = isGuest ? 'inline-block' : 'none';

    document.getElementById('header-email').textContent = isGuest ? "Guest Mode" : user.email;
    document.getElementById('header-name').textContent = user.displayName || (isGuest ? "Guest" : "User");
    
    document.getElementById('acc-username').value = user.displayName || "";
    document.getElementById('acc-avatar').value = user.photoURL || "";
    if(user.photoURL) document.getElementById('current-avatar').src = user.photoURL;
    
    if(!isGuest && document.getElementById('acc-email')) {
        document.getElementById('acc-email').value = user.email;
    }

    try {
        const doc = await db.collection('users').doc(user.uid).get();
        if (doc.exists && doc.data().bio) {
            document.getElementById('acc-bio').value = doc.data().bio;
        }
    } catch (e) { console.log(e); }
}

function previewAvatar(url) {
    if(url.length > 10) document.getElementById('current-avatar').src = url;
}

// UPDATE PROFILE
async function saveAccountSettings(e) {
    e.preventDefault();
    const user = auth.currentUser;
    if(!user) return;

    if(user.isAnonymous) {
        showToast("Guests: Link account to save Profile info.", "info");
    }

    const newName = document.getElementById('acc-username').value;
    const newAvatar = document.getElementById('acc-avatar').value;
    const newBio = document.getElementById('acc-bio').value;
    const btn = document.querySelector('.btn-save');

    btn.textContent = "Saving...";
    btn.disabled = true;

    try {
        if (!user.isAnonymous) {
            await user.updateProfile({
                displayName: newName,
                photoURL: newAvatar
            });
        }

        await db.collection('users').doc(user.uid).set({
            bio: newBio,
            email: user.email || "guest"
        }, { merge: true });

        updateUserDisplay(user);
        showToast("Settings Saved!", "success");
        setTimeout(() => location.reload(), 1000);
    } catch (error) {
        showToast(error.message, "error");
        btn.textContent = "Save Changes";
        btn.disabled = false;
    }
}

// UPDATE EMAIL WITH VERIFICATION
function updateUserEmail() {
    const user = auth.currentUser;
    const newEmail = document.getElementById('acc-email').value;
    const btn = document.querySelector('#email-update-section button');
    
    if(user.isAnonymous) return; 
    if(!newEmail.includes('@')) { showToast("Invalid Email", "error"); return; }
    if(newEmail === user.email) { showToast("That is your current email.", "info"); return; }

    btn.textContent = "Updating...";
    btn.disabled = true;

    user.updateEmail(newEmail)
        .then(() => {
            showToast("Email Updated! Sending verification...", "success");
            document.getElementById('header-email').textContent = newEmail;
            return user.sendEmailVerification();
        })
        .then(() => {
            showToast("✅ Verification sent to " + newEmail, "success");
            btn.textContent = "Done";
            setTimeout(() => { btn.disabled = false; btn.textContent = "Update"; }, 3000);
        })
        .catch(error => {
            btn.textContent = "Update";
            btn.disabled = false;
            
            if (error.code === 'auth/email-already-in-use') {
                showToast("❌ This email is already taken.", "error");
            } else if (error.code === 'auth/requires-recent-login') {
                showToast("🔒 Security: Please Log Out and Log In again to change email.", "error");
            } else {
                showToast(getFriendlyMsg(error), "error");
            }
        });
}

// LINK ACCOUNT
function linkProvider(providerName) {
    const user = auth.currentUser;
    let provider;

    if (providerName === 'google') {
        provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
    } else if (providerName === 'github') {
        provider = new firebase.auth.GithubAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
    }

    user.linkWithPopup(provider)
        .then((result) => {
            showToast("Account Linked Successfully!", "success");
            setTimeout(() => location.reload(), 1500);
        })
        .catch((error) => {
            showToast(getFriendlyMsg(error), "error");
        });
}

// DELETE ACCOUNT
async function deleteMyAccount() {
    const user = auth.currentUser;
    if(!user) return;
    
    if(confirm("Are you sure? This will delete all your data permanently.")) {
        try {
            await db.collection('users').doc(user.uid).delete();
            await user.delete();
            window.location.href = 'index.html';
        } catch(e) {
            if(e.code === 'auth/requires-recent-login') {
                showToast("Security: Log Out and Log In again to delete account.", "error");
            } else {
                showToast(getFriendlyMsg(e), "error");
            }
        }
    }
}

// LOGIN LOGIC
function genCaptcha() {
    const qSignin = document.getElementById('q-signin');
    if (!qSignin) return; 
    const n1 = Math.floor(Math.random() * 9) + 1, n2 = Math.floor(Math.random() * 9) + 1;
    window.captchaSum = n1 + n2; 
    qSignin.innerText = `${n1} + ${n2} = ?`;
    const qSignup = document.getElementById('q-signup');
    if(qSignup) qSignup.innerText = `${n1} + ${n2} = ?`;
}

function checkCaptcha() {
    const id = document.getElementById('signin-form').classList.contains('active') ? 'a-signin' : 'a-signup';
    const val = parseInt(document.getElementById(id).value);
    if (val !== window.captchaSum) { 
        showToast("Incorrect Math Answer!", "error"); 
        genCaptcha(); 
        return false; 
    }
    return true;
}

function handleSignIn(e) {
    e.preventDefault(); 
    if (!checkCaptcha()) return;
    
    const email = document.getElementById('signin-email').value;
    const pass = document.getElementById('signin-password').value;
    const errorBox = document.getElementById('login-error-msg');

    errorBox.style.display = 'none';
    errorBox.className = 'error-msg';

    auth.signInWithEmailAndPassword(email, pass)
        .then((userCred) => {
            if (!userCred.user.emailVerified) {
                auth.signOut();
                errorBox.style.display = 'block';
                errorBox.innerHTML = `📧 Email not verified!<br>We sent another link to <b>${email}</b>`;
                userCred.user.sendEmailVerification().catch(err => console.log("Resend limit", err));
            } else {
                showToast("Welcome back!", "success");
                setTimeout(() => { window.location.href = 'home.html'; }, 500);
            }
        })
        .catch(e => { 
            errorBox.style.display = 'block';
            errorBox.textContent = getFriendlyMsg(e);
            genCaptcha(); 
        });
}

function handleSignUp(e) {
    e.preventDefault(); 
    if (!checkCaptcha()) return;
    
    const email = document.getElementById('signup-email').value;
    const pass = document.getElementById('signup-password').value;

    auth.createUserWithEmailAndPassword(email, pass)
        .then((userCred) => { 
            userCred.user.sendEmailVerification(); 
            auth.signOut(); 
            switchForm('signin');
            setTimeout(() => {
                const errorBox = document.getElementById('login-error-msg');
                if(errorBox) {
                    errorBox.className = 'success-msg'; 
                    errorBox.style.display = 'block';
                    errorBox.innerHTML = `✅ <b>Account Created!</b><br>Verification link sent to ${email}.<br>Please verify before logging in.`;
                }
                document.getElementById('signin-email').value = email;
            }, 100);
        })
        .catch(e => { showToast(getFriendlyMsg(e), "error"); genCaptcha(); });
}

function handleGoogleLogin() { 
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    auth.signInWithPopup(provider)
        .then(() => { window.location.href = 'home.html'; })
        .catch(e => showToast(getFriendlyMsg(e), "error")); 
}

function handleGithubLogin() { 
    const provider = new firebase.auth.GithubAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    auth.signInWithPopup(provider)
        .then(() => { window.location.href = 'home.html'; })
        .catch(e => showToast(getFriendlyMsg(e), "error")); 
}

function handleGuestLogin() { 
    auth.signInAnonymously().then(() => { window.location.href = 'home.html'; }).catch(e => showToast(getFriendlyMsg(e), "error")); 
}

function togglePassword(id) { const f = document.getElementById(id); f.type = f.type === 'password' ? 'text' : 'password'; }

function switchForm(target) {
    genCaptcha(); 
    const signin = document.getElementById('signin-form');
    const signup = document.getElementById('signup-form');
    const sub = document.getElementById('sub-text');
    const errorBox = document.getElementById('login-error-msg');
    if(errorBox) { errorBox.style.display = 'none'; errorBox.className = 'error-msg'; }
    signin.classList.remove('active'); signup.classList.remove('active');
    if (target === 'signup') { signup.classList.add('active'); sub.textContent = "Start your journey with us."; } 
    else { signin.classList.add('active'); sub.textContent = "Welcome back! Please login."; }
}

function openResetModal() { document.getElementById('reset-modal').classList.add('active'); }
function closeResetModal() { document.getElementById('reset-modal').classList.remove('active'); }

async function sendResetLink() {
    const email = document.getElementById('reset-email').value;
    if(!email) { showToast("Enter email first!", "error"); return; }
    try {
        await auth.sendPasswordResetEmail(email);
        showToast("Reset link sent! Check Spam folder.", "success");
        closeResetModal();
    } catch(e) {
        showToast("If account exists, link sent (Check Spam).", "info");
        closeResetModal();
    }
}

// CONTENT
const JIKAN_API = 'https://api.jikan.moe/v4';
let currentAnimeInModal = null;
let currentPage = 1;

async function saveAnimeToList(status) {
    const user = auth.currentUser;
    if (!user) { showToast("Login required", "error"); return; }
    let progress = 0;
    if (status === 'completed') progress = currentAnimeInModal.episodes || 0;
    const animeData = {
        mal_id: currentAnimeInModal.mal_id,
        title: currentAnimeInModal.title_english || currentAnimeInModal.title,
        image_url: currentAnimeInModal.images.jpg.large_image_url,
        score: currentAnimeInModal.score || 0,
        total_episodes: currentAnimeInModal.episodes || 0,
        progress: progress, status: status, updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    updateDropdownBtnUI(status, true); closeDropdown();
    await db.collection('users').doc(user.uid).collection('animeList').doc(String(currentAnimeInModal.mal_id)).set(animeData, { merge: true });
    showToast(`Saved as ${status}`, 'success');
}

function updateDropdownBtnUI(text, success) {
    const btnText = document.getElementById('list-btn-text');
    const mainBtn = document.querySelector('.list-btn-main');
    if (btnText && mainBtn) {
        btnText.innerHTML = text; mainBtn.style.background = success ? "#22c55e" : "";
        if (success) setTimeout(() => { btnText.innerHTML = "Add to List"; mainBtn.style.background = ""; }, 2000);
    }
}

function runLoginTypewriter() {
    const tw = document.getElementById('typewriter');
    if (!tw) return;
    const text = "Hi! Akatsuki Member";
    let i = 0;
    const type = () => { if (i < text.length) { tw.textContent += text.charAt(i); i++; setTimeout(type, 100); } else tw.style.borderRight = "none"; };
    type();
}

function runHomeTypewriter() {
    const tw = document.getElementById('hero-typewriter');
    if (!tw) return;
    const text = "Welcome to the Akatsuki";
    let i = 0;
    tw.textContent = ""; 
    const type = () => { if (i < text.length) { tw.textContent += text.charAt(i); i++; setTimeout(type, 100); } else tw.style.borderRight = "none"; };
    type();
}

async function initHomePage() {
    runHomeTypewriter(); 
    const list = document.getElementById('anime-list');
    if (!list) return;
    const res = await fetch(`${JIKAN_API}/top/anime?filter=bypopularity&limit=10`);
    const data = await res.json();
    list.innerHTML = data.data.map(anime => `<div class="anime-card" onclick="openModal(${anime.mal_id})"><img src="${anime.images.jpg.large_image_url}"><div class="card-info"><div class="card-title">${anime.title_english||anime.title}</div></div></div>`).join('') + data.data.map(anime => `<div class="anime-card" onclick="openModal(${anime.mal_id})"><img src="${anime.images.jpg.large_image_url}"><div class="card-info"><div class="card-title">${anime.title_english||anime.title}</div></div></div>`).join('');
}

async function initDiscoverPage() {
    const grid = document.getElementById('discover-grid');
    if (!grid) return;
    fetchGrid();
    document.getElementById('anime-search-input').addEventListener('input', (e) => {
        currentPage = 1; setTimeout(() => fetchGrid(e.target.value), 500);
    });
}

async function fetchGrid(query = '') {
    const grid = document.getElementById('discover-grid');
    let url = `${JIKAN_API}/seasons/now?page=${currentPage}&limit=24`;
    if (query.length > 2) url = `${JIKAN_API}/anime?q=${query}&order_by=popularity&sort=asc&page=${currentPage}&sfw=true`;
    
    try {
        const res = await fetch(url); const data = await res.json();
        if (!data.data || data.data.length === 0) { grid.innerHTML = '<p style="color:#999;grid-column:1/-1;text-align:center;">No results found.</p>'; return; }
        grid.innerHTML = data.data.map(anime => `<div class="anime-card" onclick="openModal(${anime.mal_id})"><img src="${anime.images.jpg.large_image_url}" loading="lazy"><div class="card-info"><div class="card-title">${anime.title_english||anime.title}</div></div></div>`).join('');
        renderPagination(data.pagination?.last_visible_page || 1);
    } catch(e) { console.error(e); }
}

function renderPagination(lastPage) {
    const pag = document.getElementById('pagination'); if (!pag) return;
    let btns = ''; const maxBtns = 5; let start = Math.max(1, currentPage - 2); let end = Math.min(lastPage, start + maxBtns - 1);
    if (currentPage > 1) btns += `<button class="page-btn" onclick="changePage(${currentPage-1})">Prev</button>`;
    for(let i=start; i<=end; i++) btns += `<button class="page-btn ${i===currentPage?'active':''}" onclick="changePage(${i})">${i}</button>`;
    if(currentPage < lastPage) btns += `<button class="page-btn" onclick="changePage(${currentPage+1})">Next</button>`;
    pag.innerHTML = btns;
}
function changePage(p) { currentPage = p; fetchGrid(document.getElementById('anime-search-input').value); window.scrollTo({top:0,behavior:'smooth'}); }

async function openModal(id) {
    const modal = document.getElementById('anime-modal'); if (!modal) return;
    modal.classList.add('active'); document.body.style.overflow = 'hidden';
    document.getElementById('modal-title').textContent = 'Loading...'; document.getElementById('modal-poster').src = ''; updateDropdownBtnUI('Add to List');
    const res = await fetch(`${JIKAN_API}/anime/${id}/full`); const data = await res.json();
    currentAnimeInModal = data.data; populateModal(data.data);
}

function populateModal(anime) {
    if (!anime) return;
    document.getElementById('modal-poster').src = anime.images.jpg.large_image_url;
    document.getElementById('modal-banner').style.backgroundImage = `url('${anime.trailer?.images?.maximum_image_url || anime.images.jpg.large_image_url}')`;
    document.getElementById('modal-title').textContent = anime.title_english || anime.title;
    document.getElementById('modal-synopsis').textContent = anime.synopsis || "No synopsis available.";
    document.getElementById('modal-type').textContent = anime.type || '?';
    document.getElementById('modal-episodes').textContent = anime.episodes ? `${anime.episodes} eps` : '? eps';
    document.getElementById('modal-status').textContent = anime.status;
    document.getElementById('modal-rating').innerHTML = `<i class="fas fa-star"></i> ${anime.score || 'N/A'}`;
    document.getElementById('modal-genres').innerHTML = anime.genres.map(g => `<span class="genre-tag">${g.name}</span>`).join('');
}

function closeModal() { document.getElementById('anime-modal').classList.remove('active'); document.body.style.overflow = 'auto'; closeDropdown(); }
function toggleListDropdown(e) { e.stopPropagation(); document.getElementById('dropdown-menu').classList.toggle('active'); }
function closeDropdown() { const m = document.getElementById('dropdown-menu'); if (m) m.classList.remove('active'); }
window.addEventListener('click', () => closeDropdown());

let userAnimeListCache = [];
async function initMyListPage() {
    const container = document.getElementById('my-anime-list-container'); if (!container) return;
    const user = auth.currentUser; if (!user) return;
    db.collection('users').doc(user.uid).collection('animeList').orderBy('updatedAt', 'desc').onSnapshot((snapshot) => {
        if (snapshot.empty) { container.innerHTML = `<div class="empty-list-state"><i class="fas fa-box-open"></i><h3>Your list is empty</h3><p>Time to start your adventure. Go find some anime!</p><a href="discover.html" class="btn-empty-cta">Browse Anime</a></div>`; userAnimeListCache = []; } 
        else { userAnimeListCache = snapshot.docs.map(doc => doc.data()); renderMyList(userAnimeListCache); }
    });
}

function renderMyList(listData) {
    const container = document.getElementById('my-anime-list-container');
    if (listData.length === 0) { container.innerHTML = '<p style="color:#999;text-align:center;">No anime found.</p>'; return; }
    container.innerHTML = listData.map(anime => {
        const isPlanning = anime.status === 'planning';
        const progressStyle = isPlanning ? 'display: none !important;' : 'display: flex;';
        return `
        <div class="list-card">
            <img src="${anime.image_url}" class="list-poster">
            <div class="list-details"><div class="list-title">${anime.title}</div><div class="list-meta-row"><span class="rating-badge">⭐ ${anime.score || 'N/A'}</span><span>•</span><span>${anime.total_episodes || '?'} eps</span></div></div>
            <div class="list-actions">
                <div class="episode-control" style="${progressStyle}">
                    <button class="ep-btn" onclick="updateProgress(${anime.mal_id}, ${(anime.progress || 0) - 1})">-</button>
                    <span class="ep-text">${anime.progress || 0} / ${anime.total_episodes || '?'}</span>
                    <button class="ep-btn" onclick="updateProgress(${anime.mal_id}, ${(anime.progress || 0) + 1})">+</button>
                </div>
                <select class="status-select" onchange="updateStatusDirectly(${anime.mal_id}, this.value)">
                    <option value="watching" ${anime.status === 'watching' ? 'selected' : ''}>Watching</option>
                    <option value="completed" ${anime.status === 'completed' ? 'selected' : ''}>Completed</option>
                    <option value="planning" ${anime.status === 'planning' ? 'selected' : ''}>Planning</option>
                    <option value="dropped" ${anime.status === 'dropped' ? 'selected' : ''}>Dropped</option>
                </select>
                <button class="delete-btn" onclick="deleteAnime(${anime.mal_id})"><i class="fas fa-trash"></i></button>
            </div>
        </div>`;
    }).join('');
}

async function updateProgress(id, prog) { if (prog < 0) return; await db.collection('users').doc(auth.currentUser.uid).collection('animeList').doc(String(id)).update({ progress: prog }); }
async function updateStatusDirectly(animeId, newStatus) {
    let updateData = { status: newStatus };
    if (newStatus === 'completed') { const anime = userAnimeListCache.find(a => a.mal_id == animeId); if (anime && anime.total_episodes) updateData.progress = anime.total_episodes; }
    await db.collection('users').doc(auth.currentUser.uid).collection('animeList').doc(String(animeId)).update(updateData);
    showToast(`Moved to ${newStatus}`, 'success');
}
async function deleteAnime(id) { if (confirm("Delete?")) await db.collection('users').doc(auth.currentUser.uid).collection('animeList').doc(String(id)).delete(); }
function filterList(status) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active')); event.target.classList.add('active');
    renderMyList(status === 'all' ? userAnimeListCache : userAnimeListCache.filter(i => i.status === status));
}

window.addEventListener('load', () => {
    const loader = document.getElementById('preloader');
    if(loader) { loader.style.opacity = '0'; setTimeout(() => { loader.style.display = 'none'; }, 500); }
    
    if (document.getElementById('q-signin')) { genCaptcha(); runLoginTypewriter(); }
});