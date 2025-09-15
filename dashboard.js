import { auth, db } from './firebase-init.js';
import {
    createUserWithEmailAndPassword, 
    signOut, 
    signInWithEmailAndPassword, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

import { 
    doc, 
    collection, 
    setDoc, 
    getDoc, 
    query, 
    limit, 
    orderBy, 
    getDocs
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Utility selectors
const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => parent.querySelectorAll(selector);

// DOM References
const refs = {
    // Auth elements
    registerBtn: $('#register-btn'),
    loginForm: $('#login-form'),
    authForm: $('#auth-form'),
    loginBtn: $('#login-btn'),
    logOutBtn: $('#logout-btn'),
    loginText: $('#login-text'),
    loginSpinner: $('#login-spinner'),
    emailInput: $('#email'),
    emailError: $('#email-error'),
    passwordInput: $('#password'),
    passwordError: $('#password-error'),
    errorMessage: $('#error-message'),
    successMessage: $('#success-message'),
    
    // Dashboard elements
    dashboard: $('#dashboard'),
    userDisplayName: $('#user-display-name'),
    topPlayerPairs: $('#top-pair-players-list'),
    topPlayerPuzzles: $('#top-puzzle-players-list'),
    mostActivePlayer: $('#most-active-list'),
    
    // Navigation buttons
    playPairButton: $('#play-pair-button'),
    playPuzzleButton: $('#play-puzzle-button'),
    inventoryButton: $('#inventory-button')
};

// Application state
let currentUser = null;
let isRegistering = false;

// Utility Functions
const getPlayerName = (email, nickname = null) => {
    if (nickname && nickname.trim()) return nickname;
    return !email ? "Anonymous" : email.split("@")[0];
};

const formatTime = (seconds) => {
    if (!seconds || seconds === 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
};

// UI Helper Functions
function showError(message) {
    refs.errorMessage.classList.remove('hidden');
    refs.successMessage.classList.add('hidden');
    refs.errorMessage.textContent = message;
    
    // Auto-hide after 6 seconds
    setTimeout(() => {
        refs.errorMessage.classList.add('hidden');
        refs.errorMessage.textContent = '';
    }, 8000);
}

function showSuccess(message) {
    refs.successMessage.classList.remove('hidden');
    refs.errorMessage.classList.add('hidden');
    refs.successMessage.textContent = message;
    
    // Auto-hide after 4 seconds
    setTimeout(() => {
        refs.successMessage.classList.add('hidden');
        refs.successMessage.textContent = '';
    }, 4000);
}

function hideMessages() {
    refs.errorMessage.classList.add('hidden');
    refs.successMessage.classList.add('hidden');
}

function setLoading(loading) {
    refs.loginText.classList.toggle('hidden', loading);
    refs.loginBtn.disabled = loading;
    refs.loginSpinner.classList.toggle('hidden', !loading);
    
    if (loading) {
        refs.loginBtn.classList.add('opacity-75', 'cursor-not-allowed');
    } else {
        refs.loginBtn.classList.remove('opacity-75', 'cursor-not-allowed');
    }
}

// Validation Functions
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePassword(password) {
    return password && password.length >= 6;
}

function validateForm() {
    let isValid = true;
    hideMessages();
    
    // Email validation
    const email = refs.emailInput.value.trim();
    if (!email || !validateEmail(email)) {
        isValid = false;
        refs.emailInput.classList.add('border-red-500');
        refs.emailError.classList.remove('hidden');
    } else {
        refs.emailError.classList.add('hidden');
        refs.emailInput.classList.remove('border-red-500');
    }
    
    // Password validation
    const password = refs.passwordInput.value;
    if (!validatePassword(password)) {
        refs.passwordInput.classList.add('border-red-500');
        refs.passwordError.classList.remove('hidden');
        isValid = false;
    } else {
        refs.passwordInput.classList.remove('border-red-500');
        refs.passwordError.classList.add('hidden');
    }
    
    return isValid;
}

// Auth Mode Toggle
function toggleMode() {
    isRegistering = !isRegistering;
    const subheading = refs.loginForm.querySelector('p');
    const heading = refs.loginForm.querySelector('h1');
    
    if (isRegistering) {
        heading.textContent = 'Create Account';
        subheading.textContent = 'To join the game today!';
        refs.loginText.textContent = 'Create Account';
        refs.registerBtn.textContent = 'Back to Sign In';
    } else {
        heading.textContent = 'Welcome Back!';
        subheading.textContent = 'Sign in to your account';
        refs.loginText.textContent = 'Sign In';
        refs.registerBtn.textContent = 'Create Account';
    }
    
    hideMessages();
}

// Display Functions
function showDashboard(user) {
    refs.userDisplayName.textContent = getPlayerName(user.email);
    refs.loginForm.classList.add('hidden');
    refs.dashboard.classList.remove('hidden');
}

function showLoginForm() {
    refs.dashboard.classList.add('hidden');
    refs.loginForm.classList.remove('hidden');
}

// Firebase Authentication
async function handleAuth(email, password) {
    try {
        setLoading(true);
        let userCredential;
        
        if (isRegistering) {
            userCredential = await createUserWithEmailAndPassword(auth, email, password);
            showSuccess('Account created successfully!');
        } else {
            userCredential = await signInWithEmailAndPassword(auth, email, password);
            showSuccess('Signed in successfully!');
        }
        
        // Small delay for better UX
        setTimeout(() => {
            showDashboard(userCredential.user);
            initializeDashboard(userCredential.user);
        }, 500);
        
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
                errorMsg = 'Password must be at least 6 characters.';
                break;
            case 'auth/invalid-email':
                errorMsg = 'Please enter a valid email address.';
                break;
            case 'auth/invalid-credential':
                errorMsg = 'Invalid email or password. Please try again.';
                break;
            default:
                errorMsg = `Authentication failed: ${error.message}`;
        }
        
        showError(errorMsg);
    } finally {
        setLoading(false);
    }
}

async function logout() {
    try {
        await signOut(auth);
        showLoginForm();
        showSuccess('Signed out successfully!');
        
        // Clear form
        refs.emailInput.value = '';
        refs.passwordInput.value = '';
        
        // Reset validation states
        refs.emailInput.classList.remove('border-red-500');
        refs.passwordInput.classList.remove('border-red-500');
        refs.emailError.classList.add('hidden');
        refs.passwordError.classList.add('hidden');
        
    } catch (error) {
        console.error('Logout error:', error);
        showError('Error signing out. Please try again.');
    }
}

// User Stats Management
async function loadUserStats(user) {
    try {
        currentUser = user;
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        
        let userStats;
        if (userDoc.exists()) {
            userStats = userDoc.data();
        } else {
            // Create new user document with proper initialization
            userStats = {
                email: user.email,
                nickname: '',
                highScore: 0,
                gamesPlayed: 0,
                puzzleHighScore: 0,
                puzzleGamesPlayed: 0,
                bestPuzzleMoves: 0,
                bestPuzzleTime: 0,
                totalGamesPlayed: 0,
                createdAt: new Date()
            };
            await setDoc(userDocRef, userStats);
        }
        
        return userStats;
    } catch (error) {
        console.error("Error loading user stats:", error);
        throw error;
    }
}

// Dashboard Data Loading
async function topPlayerAtPairings() {
    try {
        const topPlayersQuery = query(
            collection(db, "users"), 
            orderBy("highScore", "desc"), 
            limit(5)
        );
        
        const querySnapshot = await getDocs(topPlayersQuery);
        refs.topPlayerPairs.innerHTML = "";
        
        if (querySnapshot.empty) {
            refs.topPlayerPairs.innerHTML = '<div class="text-center py-4 text-gray-500">No players yet</div>';
            return;
        }
        
        let position = 1;
        querySnapshot.forEach(doc => {
            const player = doc.data();
            const isCurrentUser = currentUser && doc.id === currentUser.uid;
            const playerElement = document.createElement("div");
            
            playerElement.className = `flex justify-between items-center py-2 px-3 rounded ${
                isCurrentUser ? "bg-blue-50 border border-blue-200" : "bg-gray-50"
            }`;

            const displayName = getPlayerName(player.email, player.nickname);
            const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '';
            
            playerElement.innerHTML = `
                <div class="flex items-center space-x-2">
                    <span class="font-bold text-sm">${medal} #${position}</span>
                    <span class="text-sm ${isCurrentUser ? "text-blue-800 font-medium" : "text-gray-800"}">
                        ${displayName} ${isCurrentUser ? "(You)" : ""}
                    </span>
                </div>
                <span class="font-bold text-sm text-green-600">${player.highScore || 0}</span>
            `;
            
            refs.topPlayerPairs.appendChild(playerElement);
            position++;
        });
        
    } catch (error) {
        console.error("Error loading top players:", error);
        refs.topPlayerPairs.innerHTML = '<div class="text-center text-sm py-2 text-red-600 bg-red-100 rounded">Failed to load!</div>';
    }
}

async function topPlayerAtPuzzle() {
    try {
        // Query for best moves (fewest moves is better, so we order by ascending)
        const topMovesQuery = query(
            collection(db, "users"), 
            orderBy("bestPuzzleMoves", "asc"), 
            limit(5)
        );
        
        const querySnapshot = await getDocs(topMovesQuery);
        refs.topPlayerPuzzles.innerHTML = "";
        
        if (querySnapshot.empty) {
            refs.topPlayerPuzzles.innerHTML = '<div class="text-center py-4 text-gray-500">No players yet</div>';
            return;
        }
        
        let position = 1;
        querySnapshot.forEach(doc => {
            const player = doc.data();
            const isCurrentUser = currentUser && doc.id === currentUser.uid;
            
            // Skip players with no puzzle data
            if (!player.bestPuzzleMoves || player.bestPuzzleMoves === 0) return;
            
            const playerElement = document.createElement("div");
            playerElement.className = `flex justify-between items-center py-2 px-3 rounded ${
                isCurrentUser ? "bg-blue-50 border border-blue-200" : "bg-gray-50"
            }`;

            const displayName = getPlayerName(player.email, player.nickname);
            const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '';
            
            playerElement.innerHTML = `
                <div class="flex items-center space-x-2">
                    <span class="font-bold text-sm">${medal} #${position}</span>
                    <span class="text-sm ${isCurrentUser ? "text-blue-800 font-medium" : "text-gray-800"}">
                        ${displayName} ${isCurrentUser ? "(You)" : ""}
                    </span>
                </div>
                <div class="text-right">
                    <span class="font-bold text-xs text-purple-600">${player.bestPuzzleMoves} moves</span>
                    ${player.bestPuzzleTime ? `<br><span class="text-xs text-gray-600">${formatTime(player.bestPuzzleTime)}</span>` : ''}
                </div>
            `;
            
            refs.topPlayerPuzzles.appendChild(playerElement);
            position++;
        });
        
    } catch (error) {
        console.error("Error loading top puzzle players:", error);
        refs.topPlayerPuzzles.innerHTML = '<div class="text-center text-sm py-2 text-red-600 bg-red-100 rounded">Failed to load!</div>';
    }
}

async function mostActivePlayers() {
    try {
        const activePlayersQuery = query(
            collection(db, "users"), 
            orderBy("totalGamesPlayed", "desc"), 
            limit(5)
        );
        
        const querySnapshot = await getDocs(activePlayersQuery);
        refs.mostActivePlayer.innerHTML = "";
        
        if (querySnapshot.empty) {
            refs.mostActivePlayer.innerHTML = '<div class="text-center py-4 text-gray-500">No players yet</div>';
            return;
        }
        
        let position = 1;
        querySnapshot.forEach(doc => {
            const player = doc.data();
            const isCurrentUser = currentUser && doc.id === currentUser.uid;
            
            // Calculate total games
            const totalGames = (player.gamesPlayed || 0) + (player.puzzleGamesPlayed || 0);
            if (totalGames === 0) return;
            
            const playerElement = document.createElement("div");
            playerElement.className = `flex justify-between items-center py-2 px-3 rounded ${
                isCurrentUser ? "bg-blue-50 border border-blue-200" : "bg-gray-50"
            }`;

            const displayName = getPlayerName(player.email, player.nickname);
            const medal = position === 1 ? '👑' : position === 2 ? '⭐' : position === 3 ? '🔥' : '';
            
            playerElement.innerHTML = `
                <div class="flex items-center space-x-2">
                    <span class="font-bold text-sm">${medal} #${position}</span>
                    <span class="text-sm ${isCurrentUser ? "text-blue-800 font-medium" : "text-gray-800"}">
                        ${displayName} ${isCurrentUser ? "(You)" : ""}
                    </span>
                </div>
                <span class="font-bold text-sm text-indigo-600">${totalGames} games</span>
            `;
            
            refs.mostActivePlayer.appendChild(playerElement);
            position++;
        });
        
    } catch (error) {
        console.error("Error loading most active players:", error);
        refs.mostActivePlayer.innerHTML = '<div class="text-center text-sm py-2 text-red-600 bg-red-100 rounded">Failed to load!</div>';
    }
}

// Dashboard Initialization
async function initializeDashboard(user) {
    try {
        await Promise.all([
            loadUserStats(user),
            topPlayerAtPairings(),
            topPlayerAtPuzzle(),
            mostActivePlayers()
        ]);
    } catch (error) {
        console.error('Error initializing dashboard:', error);
    }
}

// Navigation Functions
function navigateToPage(url) {
    window.location.href = url;
}

// Event Listeners
refs.authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (validateForm()) {
        const email = refs.emailInput.value.trim();
        const password = refs.passwordInput.value;
        await handleAuth(email, password);
    }
});

refs.registerBtn.addEventListener('click', (e) => {
    e.preventDefault();
    toggleMode();
});

refs.logOutBtn.addEventListener('click', logout);

// Real-time validation
refs.emailInput.addEventListener('input', () => {
    const email = refs.emailInput.value.trim();
    if (email && validateEmail(email)) {
        refs.emailError.classList.add('hidden');
        refs.emailInput.classList.remove('border-red-500');
    }
});

refs.passwordInput.addEventListener('input', () => {
    const password = refs.passwordInput.value;
    if (password && validatePassword(password)) {
        refs.passwordError.classList.add('hidden');
        refs.passwordInput.classList.remove('border-red-500');
    }
});

// Navigation button listeners
refs.playPairButton.addEventListener('click', () => navigateToPage('game.html'));
refs.playPuzzleButton.addEventListener('click', () => navigateToPage('puzzle.html'));
refs.inventoryButton.addEventListener('click', () => navigateToPage('inventory.html'));

// Authentication State Listener
onAuthStateChanged(auth, (user) => {
    // Show the page now that auth state is determined
    document.body.classList.add('auth-ready');
    
    if (user) {
        showDashboard(user);
        initializeDashboard(user);
    } else {
        showLoginForm();
        currentUser = null;
    }
});