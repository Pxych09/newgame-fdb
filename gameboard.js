// ===== DOM Utilities =====
const $ = (sel, scope = document) => scope.querySelector(sel);
const $$ = (sel, scope = document) => scope.querySelectorAll(sel);
const $id = (id) => document.getElementById(id);
const $create = (tag, props = {}) => Object.assign(document.createElement(tag), props);

// ===== DOM References =====
const refs = {
    loginForm: $id('login-form'),
    dashboard: $id('dashboard'),
    emailInput: $id('email'),
    passwordInput: $id('password'),
    loginBtn: $id('login-btn'),
    registerBtn: $id('register-btn'),
    loginText: $id('login-text'),
    loginSpinner: $id('login-spinner'),
    errorMessage: $id('error-message'),
    successMessage: $id('success-message'),
    userEmailDisplay: $id('user-email'),
    emailError: $id('email-error'),
    passwordError: $id('password-error'),
    heading: $('h1'),
    subheading: $('h1 + p'),
    userHighScore: $id("user-high-score"),
    userGamesPlayed: $id("user-games-played"),
    userAvgScore: $id("user-avg-score"),
    userRank: $id("user-rank"),
    topPlayersList: $id("top-players-list"),
    mostActiveList: $id("most-active-list"),
};

let isRegistering = false;
let currentUser = null;
let userStats = {};
let currentGameScore = 0;

const getPlayerName = (email) => (!email ? "Anonymous" : email.split("@")[0]);

// ===== Utility Functions =====
function showError(message) {
    refs.errorMessage.textContent = message;
    refs.errorMessage.classList.remove('hidden');
    refs.successMessage.classList.add('hidden');
}

function showSuccess(message) {
    refs.successMessage.textContent = message;
    refs.successMessage.classList.remove('hidden');
    refs.errorMessage.classList.add('hidden');
}

function hideMessages() {
    refs.errorMessage.classList.add('hidden');
    refs.successMessage.classList.add('hidden');
}

function setLoading(loading) {
    if (loading) {
        refs.loginBtn.disabled = true;
        refs.loginText.classList.add('hidden');
        refs.loginSpinner.classList.remove('hidden');
    } else {
        refs.loginBtn.disabled = false;
        refs.loginText.classList.remove('hidden');
        refs.loginSpinner.classList.add('hidden');
    }
}

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePassword(password) {
    return password.length >= 6;
}

function validateForm() {
    let isValid = true;
    hideMessages();

    // Email validation
    const email = refs.emailInput.value.trim();
    if (!email || !validateEmail(email)) {
        refs.emailError.classList.remove('hidden');
        refs.emailInput.classList.add('border-red-500');
        isValid = false;
    } else {
        refs.emailError.classList.add('hidden');
        refs.emailInput.classList.remove('border-red-500');
    }

    // Password validation
    const password = refs.passwordInput.value;
    if (!password || !validatePassword(password)) {
        refs.passwordError.classList.remove('hidden');
        refs.passwordInput.classList.add('border-red-500');
        isValid = false;
    } else {
        refs.passwordError.classList.add('hidden');
        refs.passwordInput.classList.remove('border-red-500');
    }

    return isValid;
}

function toggleMode() {
    isRegistering = !isRegistering;

    if (isRegistering) {
        refs.loginText.textContent = 'Create Account';
        refs.registerBtn.textContent = 'Back to Sign In';
        refs.heading.textContent = 'Create Account';
        refs.subheading.textContent = 'Join the game today!';
    } else {
        refs.loginText.textContent = 'Sign In';
        refs.registerBtn.textContent = 'Create Account';
        refs.heading.textContent = 'Welcome Back!';
        refs.subheading.textContent = 'Sign in to your account';
    }
    hideMessages();
} 

// ===== Load Most Active Players =====
async function loadMostActive() {
    try {
      const usersRef = window.firestoreCollection(window.firebaseDb, "users");
      const activePlayersQuery = window.firestoreQuery(
        usersRef,
        window.firestoreOrderBy("gamesPlayed", "desc"),
        window.firestoreLimit(10)
      );

      const querySnapshot = await window.firestoreGetDocs(activePlayersQuery);
      refs.mostActiveList.innerHTML = "";

      let position = 1;
      querySnapshot.forEach((doc) => {
        const player = doc.data();
        const isCurrentUser = doc.id === currentUser.uid;

        const playerElement = $create("div", {
          className: `flex items-center justify-between p-3 rounded-lg ${
            isCurrentUser ? "bg-green-50 border-2 border-green-200" : "bg-gray-50"
          }`,
          innerHTML: `
            <div class="flex items-center space-x-3">
              <span class="font-bold text-lg ${position <= 3 ? "text-green-600" : "text-gray-600"}">#${position}</span>
              <span class="font-sm ${isCurrentUser ? "text-green-800" : "text-gray-800"}">
                ${getPlayerName(player.email)} ${isCurrentUser ? "(You)" : ""}
              </span>
            </div>
            <div class="text-right">
              <div class="font-bold text-gray-800">${player.gamesPlayed || 0} games</div>
              <div class="text-xs text-gray-500">High: ${player.highScore || 0}</div>
            </div>
          `,
        });

        refs.mostActiveList.appendChild(playerElement);
        position++;
      });
    } catch (error) {
      console.error("Error loading most active players:", error);
    }
}

// ===== Load Top Players =====
async function loadTopPlayers() {
    try {
      const usersRef = window.firestoreCollection(window.firebaseDb, "users");
      const topPlayersQuery = window.firestoreQuery(
        usersRef,
        window.firestoreOrderBy("highScore", "desc"),
        window.firestoreLimit(10)
      );

      const querySnapshot = await window.firestoreGetDocs(topPlayersQuery);
      refs.topPlayersList.innerHTML = "";

      let position = 1;
      querySnapshot.forEach((doc) => {
        const player = doc.data();
        const isCurrentUser = doc.id === currentUser.uid;

        const playerElement = $create("div", {
          className: `flex items-center justify-between p-3 rounded-lg ${
            isCurrentUser ? "bg-blue-50 border-2 border-blue-200" : "bg-gray-50"
          }`,
          innerHTML: `
            <div class="flex items-center space-x-2">
              <span class="font-bold text-lg ${position <= 3 ? "text-yellow-600" : "text-gray-600"}">#${position}</span>
              <span class="font-medium ${isCurrentUser ? "text-blue-800" : "text-gray-800"}">
                ${getPlayerName(player.email)} ${isCurrentUser ? "(You)" : ""}
              </span>
            </div>
            <div class="text-right">
              <div class="font-bold text-gray-800">${player.highScore || 0}</div>
              <div class="text-xs text-gray-500">${player.gamesPlayed || 0} games</div>
            </div>
          `,
        });

        refs.topPlayersList.appendChild(playerElement);
        position++;
      });
    } catch (error) {
      console.error("Error loading top players:", error);
    }
}

// ===== Load User Stats Function =====
async function loadUserStats(user) {
    try {
        currentUser = user;
        
        // Get user document from Firestore
        const userDoc = await window.firestoreGetDoc(
            window.firestoreDoc(window.firebaseDb, "users", user.uid)
        );
        
        if (userDoc.exists()) {
            userStats = userDoc.data();
            refs.userHighScore.textContent = userStats.highScore || 0;
            refs.userGamesPlayed.textContent = userStats.gamesPlayed || 0;
        } else {
            // Create new user document if it doesn't exist
            userStats = {
                email: user.email,
                highScore: 0,
                gamesPlayed: 0,
                createdAt: new Date()
            };
            
            await window.firestoreSetDoc(
                window.firestoreDoc(window.firebaseDb, "users", user.uid),
                userStats
            );
            
            refs.userHighScore.textContent = 0;
            refs.userGamesPlayed.textContent = 0;
        }
        
        // Calculate and display average score and rank
        await calculateAverageScore();
        await calculateUserRank();
        
    } catch (error) {
        console.error("Error loading user stats:", error);
        // Set default values on error
        refs.userHighScore.textContent = 0;
        refs.userGamesPlayed.textContent = 0;
        refs.userAvgScore.textContent = 0;
        refs.userRank.textContent = "N/A";
    }
}
// ===== Fixed Calculate Average Score (No Index Required) =====
async function calculateAverageScore() {
    try {
        const gamesRef = window.firestoreCollection(window.firebaseDb, "games");
        
        // Option 1: Simple query without orderBy (no index needed)
        const userGamesQuery = window.firestoreQuery(
            gamesRef,
            window.firestoreWhere("userId", "==", currentUser.uid)
        );

        const querySnapshot = await window.firestoreGetDocs(userGamesQuery);
        
        // Convert to array and sort in JavaScript instead of Firestore
        const games = [];
        querySnapshot.forEach((doc) => {
            const gameData = doc.data();
            games.push(gameData);
        });
        
        // Sort by timestamp descending (newest first)
        games.sort((a, b) => {
            const timeA = a.timestamp?.toDate?.() || a.timestamp || 0;
            const timeB = b.timestamp?.toDate?.() || b.timestamp || 0;
            return timeB - timeA;
        });
        
        // Take only the last 10 games
        const recentGames = games.slice(0, 10);
        
        let totalScore = 0;
        let gameCount = recentGames.length;

        recentGames.forEach((game) => {
            totalScore += game.score || 0;
        });

        const avgScore = gameCount > 0 ? Math.round(totalScore / gameCount) : 0;
        refs.userAvgScore.textContent = avgScore;
        
    } catch (error) {
        console.error("Error calculating average score:", error);
        refs.userAvgScore.textContent = 0;
    }
}


// ===== Calculate User Rank =====
async function calculateUserRank() {
    try {
        const usersRef = window.firestoreCollection(window.firebaseDb, "users");
        
        // Get all users (or use a simpler query)
        const querySnapshot = await window.firestoreGetDocs(usersRef);
        
        // Convert to array and sort in JavaScript
        const users = [];
        querySnapshot.forEach((doc) => {
            const userData = doc.data();
            users.push({
                id: doc.id,
                highScore: userData.highScore || 0
            });
        });
        
        // Sort by high score descending
        users.sort((a, b) => b.highScore - a.highScore);
        
        // Find current user's rank
        const userIndex = users.findIndex(user => user.id === currentUser.uid);
        const rank = userIndex >= 0 ? userIndex + 1 : null;
        
        refs.userRank.textContent = rank ? `#${rank}` : "N/A";
        
    } catch (error) {
        console.error("Error calculating rank:", error);
        refs.userRank.textContent = "N/A";
    }
}

function showDashboard(user) {
    refs.loginForm.classList.add('hidden');
    refs.dashboard.classList.remove('hidden');
    refs.userEmailDisplay.textContent = `${getPlayerName(user.email)}`;
}

function showLoginForm() {
    refs.loginForm.classList.remove('hidden');
    refs.dashboard.classList.add('hidden');
}

// ===== Firebase Auth Functions =====
async function handleAuth(email, password) {
    try {
        setLoading(true);

        if (isRegistering) {
            const userCredential = await window.createUserWithEmailAndPassword(window.firebaseAuth, email, password);
            showSuccess('Account created successfully! Welcome to the game!');
            setTimeout(() => showDashboard(userCredential.user), 1500);
        } else {
            const userCredential = await window.signInWithEmailAndPassword(window.firebaseAuth, email, password);
            showSuccess('Signed in successfully! Welcome back!');
            setTimeout(() => showDashboard(userCredential.user), 1500);
        }
    } catch (error) {
        console.error('Authentication error:', error);
        let errorMsg = 'An error occurred. Please try again.';

        switch (error.code) {
            case 'auth/user-not-found':
                errorMsg = 'No account found with this email address.';
                break;
            case 'auth/wrong-password':
                errorMsg = 'Incorrect password. Please try again.';
                break;
            case 'auth/email-already-in-use':
                errorMsg = 'An account with this email already exists.';
                break;
            case 'auth/weak-password':
                errorMsg = 'Password should be at least 6 characters long.';
                break;
            case 'auth/invalid-email':
                errorMsg = 'Please enter a valid email address.';
                break;
            case 'auth/too-many-requests':
                errorMsg = 'Too many failed attempts. Please try again later.';
                break;
        }

        showError(errorMsg);
    } finally {
        setLoading(false);
    }
}

async function logout() {
    try {
        await window.signOut(window.firebaseAuth);
        showLoginForm();
        showSuccess('Signed out successfully!');
        refs.emailInput.value = '';
        refs.passwordInput.value = '';
    } catch (error) {
        console.error('Logout error:', error);
        showError('Error signing out. Please try again.');
    }
}

function startGame() {
    // showSuccess('Loading game...');
    window.location.href = 'game.html';
    // Or: if (typeof initializeGame === 'function') initializeGame();
}

// ===== Event Listeners =====
refs.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (validateForm()) {
        const email = refs.emailInput.value.trim();
        const password = refs.passwordInput.value;
        await handleAuth(email, password);
    }
});

refs.registerBtn.addEventListener('click', toggleMode);

// Real-time input validation
refs.emailInput.addEventListener('input', () => {
    if (refs.emailInput.value && validateEmail(refs.emailInput.value.trim())) {
        refs.emailError.classList.add('hidden');
        refs.emailInput.classList.remove('border-red-500');
    }
});

refs.passwordInput.addEventListener('input', () => {
    if (refs.passwordInput.value && validatePassword(refs.passwordInput.value)) {
        refs.passwordError.classList.add('hidden');
        refs.passwordInput.classList.remove('border-red-500');
    }
});

// ===== Initialize Dashboard =====
async function initializeDashboard(user) {
    console.log("hello here...", user)
    await loadUserStats(user);
    await loadTopPlayers();
    await loadMostActive();
}

// Check auth state on page load
window.addEventListener('load', () => {
    if (window.firebaseAuth && window.onAuthStateChanged) {
        window.onAuthStateChanged(window.firebaseAuth, (user) => {
            if (user) {
                showDashboard(user);
                initializeDashboard(user);
            } else {
                showLoginForm();
            }
        });
    }
});

async function endGame(finalScore) {
    currentGameScore = finalScore; // currentGameScore is not defined
    await saveGameScore(); // saveGameScore function is also missing
}
