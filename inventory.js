import { auth, db } from './firebase-init.js';
import { 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { 
    doc, 
    getDoc, 
    updateDoc,
    collection,
    query,
    orderBy,
    limit,
    getDocs
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// DOM References
const refs = {
    authCheck: document.getElementById('auth-check'),
    loginPrompt: document.getElementById('login-prompt'),
    inventoryContainer: document.getElementById('inventory-container'),
    userStats: document.getElementById('user-stats'),
    
    // Nickname elements
    nicknameInput: document.getElementById('nickname-input'),
    saveNicknameBtn: document.getElementById('save-nickname-btn'),
    nicknameMessage: document.getElementById('nickname-message'),
    nicknameCounter: document.getElementById('nickname-counter'),
    
    // Tile elements
    tileInput: document.getElementById('tile-input'),
    addTileBtn: document.getElementById('add-tile-btn'),
    tileGrid: document.getElementById('tile-grid'),
    tileCount: document.getElementById('tile-count'),
    clearTilesBtn: document.getElementById('clear-tiles-btn'),
    saveCardsBtn: document.getElementById('save-cards-btn'),
    cardsMessage: document.getElementById('cards-message'),
    
    // Stats elements
    pairsHighScore: document.getElementById('pairs-high-score'),
    puzzleBestMoves: document.getElementById('puzzle-best-moves'),
    totalGames: document.getElementById('total-games'),
    userRank: document.getElementById('user-rank'),
    
    // Navigation
    logoutBtn: document.getElementById('logout-btn')
};

// Application state
let currentUser = null;
let selectedTiles = new Set();
let tileToReplace = null;

// Preset tile collections
const PRESETS = {
    emojis: ['🎮', '🎯', '🎪', '🎭', '🎨', '🎵', '🎲', '🎊'],
    animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼'],
    symbols: ['⭐', '💎', '🔥', '⚡', '🌟', '💫', '✨', '🔮'],
    letters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
};

// Utility Functions
const getPlayerName = (email, nickname = null) => {
    if (nickname && nickname.trim()) return nickname;
    return !email ? "Anonymous" : email.split("@")[0];
};

const isValidTile = (tile) => {
    if (!tile || tile.trim() === '') return false;
    const trimmed = tile.trim();
    const visibleLength = Array.from(trimmed).length;
    return visibleLength === 1;
};

// Message Display Functions
function showMessage(element, message, type = 'success') {
    element.classList.remove('hidden');
    element.textContent = message;
    
    const classes = {
        success: 'text-green-600 bg-green-50 border border-green-200',
        error: 'text-red-600 bg-red-50 border border-red-200',
        info: 'text-blue-600 bg-blue-50 border border-blue-200'
    };
    
    element.className = `mt-3 text-center text-sm p-3 rounded-lg ${classes[type] || classes.success}`;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        element.classList.add('hidden');
    }, 5000);
}

// Authentication Functions
async function logout() {
    try {
        await signOut(auth);
        refs.inventoryContainer.classList.add('hidden');
        refs.loginPrompt.classList.remove('hidden');
    } catch (error) {
        showMessage(refs.nicknameMessage, `Error signing out: ${error.message}`, 'error');
    }
}

// Nickname Management
async function saveNickname() {
    if (!currentUser) return;

    const nickname = refs.nicknameInput.value.trim();
    if (!nickname) {
        showMessage(refs.nicknameMessage, 'Nickname cannot be empty', 'error');
        return;
    }

    if (nickname.length > 20) {
        showMessage(refs.nicknameMessage, 'Nickname must be 20 characters or less', 'error');
        return;
    }

    try {
        refs.saveNicknameBtn.disabled = true;
        refs.saveNicknameBtn.innerHTML = '⏳ Saving...';
        
        const userDocRef = doc(db, "users", currentUser.uid);
        await updateDoc(userDocRef, { nickname });
        
        showMessage(refs.nicknameMessage, 'Nickname saved successfully!', 'success');
        
        // Update localStorage
        localStorage.setItem('userNickname', nickname);
        
    } catch (error) {
        showMessage(refs.nicknameMessage, `Error saving nickname: ${error.message}`, 'error');
    } finally {
        refs.saveNicknameBtn.disabled = false;
        refs.saveNicknameBtn.innerHTML = 'Save';
    }
}

function updateNicknameCounter() {
    const length = refs.nicknameInput.value.length;
    refs.nicknameCounter.textContent = `${length}/20`;
    
    if (length > 20) {
        refs.nicknameCounter.classList.add('text-red-500');
    } else {
        refs.nicknameCounter.classList.remove('text-red-500');
    }
}

// Tile Management Functions
function updateTileGrid() {
    const tiles = Array.from(selectedTiles);
    refs.tileGrid.innerHTML = '';
    
    for (let i = 0; i < 8; i++) {
        const tileDiv = document.createElement('div');
        tileDiv.className = 'tile-preview';
        
        if (i < tiles.length) {
            tileDiv.textContent = tiles[i];
            tileDiv.classList.add('selected');
            tileDiv.title = `Click to remove "${tiles[i]}"`;
            
            if (tileToReplace === tiles[i]) {
                tileDiv.classList.add('replacing');
            }
            
            tileDiv.addEventListener('click', () => removeTile(tiles[i]));
        } else {
            tileDiv.textContent = '?';
            tileDiv.classList.add('opacity-30');
        }
        
        refs.tileGrid.appendChild(tileDiv);
    }
    
    updateTileCount();
}

function updateTileCount() {
    refs.tileCount.textContent = selectedTiles.size;
    
    // Enable/disable save button
    if (selectedTiles.size === 8) {
        refs.saveCardsBtn.disabled = false;
        refs.saveCardsBtn.classList.remove('disabled:bg-gray-300', 'disabled:cursor-not-allowed');
    } else {
        refs.saveCardsBtn.disabled = true;
        refs.saveCardsBtn.classList.add('disabled:bg-gray-300', 'disabled:cursor-not-allowed');
    }
}

function addTile() {
    const tile = refs.tileInput.value.trim();
    
    if (!tile) {
        showMessage(refs.cardsMessage, 'Please enter a character', 'error');
        refs.tileInput.focus();
        return;
    }

    if (!isValidTile(tile)) {
        showMessage(refs.cardsMessage, 'Please enter a single character (emoji, letter, or symbol)', 'error');
        refs.tileInput.focus();
        return;
    }

    if (selectedTiles.has(tile)) {
        showMessage(refs.cardsMessage, 'This character is already added', 'error');
        refs.tileInput.value = '';
        refs.tileInput.focus();
        return;
    }

    if (selectedTiles.size >= 8) {
        if (!tileToReplace) {
            showMessage(refs.cardsMessage, 'You have 8 tiles. Click a tile in the grid to replace it.', 'info');
            return;
        } else {
            // Replace the selected tile
            selectedTiles.delete(tileToReplace);
            tileToReplace = null;
        }
    }

    selectedTiles.add(tile);
    refs.tileInput.value = '';
    refs.tileInput.focus();
    
    updateTileGrid();
    
    // Add animation to the newly added tile
    const tileElements = refs.tileGrid.querySelectorAll('.tile-preview.selected');
    const newTile = tileElements[tileElements.length - 1];
    if (newTile) {
        newTile.classList.add('animate-pulse-once');
    }
    
    showMessage(refs.cardsMessage, 'Tile added successfully!', 'success');
}

function removeTile(tile) {
    if (tileToReplace === tile) {
        tileToReplace = null;
    }
    
    selectedTiles.delete(tile);
    updateTileGrid();
    showMessage(refs.cardsMessage, `Removed "${tile}" from selection`, 'info');
}

function clearAllTiles() {
    if (selectedTiles.size === 0) {
        showMessage(refs.cardsMessage, 'No tiles to clear', 'info');
        return;
    }
    
    selectedTiles.clear();
    tileToReplace = null;
    updateTileGrid();
    showMessage(refs.cardsMessage, 'All tiles cleared', 'info');
}

function loadPreset(presetName) {
    if (!PRESETS[presetName]) return;
    
    if (selectedTiles.size > 0) {
        if (!confirm('This will replace your current selection. Continue?')) {
            return;
        }
    }
    
    selectedTiles.clear();
    PRESETS[presetName].forEach(tile => selectedTiles.add(tile));
    tileToReplace = null;
    
    updateTileGrid();
    showMessage(refs.cardsMessage, `Loaded ${presetName} preset!`, 'success');
}

async function saveCards() {
    if (selectedTiles.size !== 8) {
        showMessage(refs.cardsMessage, 'Please select exactly 8 unique tiles', 'error');
        return;
    }

    try {
        refs.saveCardsBtn.disabled = true;
        refs.saveCardsBtn.innerHTML = '<span class="mr-2">⏳</span>Saving...';
        
        const cardValues = [...selectedTiles, ...selectedTiles]; // Create pairs
        const userDocRef = doc(db, "users", currentUser.uid);
        
        await updateDoc(userDocRef, { cardValues });
        localStorage.setItem('customCardValues', JSON.stringify(cardValues));
        
        showMessage(refs.cardsMessage, 'Card selection saved successfully!', 'success');
        
    } catch (error) {
        showMessage(refs.cardsMessage, `Error saving cards: ${error.message}`, 'error');
    } finally {
        refs.saveCardsBtn.disabled = false;
        refs.saveCardsBtn.innerHTML = '<span class="mr-2">💾</span>Save Card Selection';
    }
}

// User Data Management
async function loadUserData() {
    if (!currentUser) return;

    try {
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
            const data = userDoc.data();
            
            // Load nickname
            if (data.nickname) {
                refs.nicknameInput.value = data.nickname;
                localStorage.setItem('userNickname', data.nickname);
            }
            
            // Load card values
            if (data.cardValues && data.cardValues.length >= 8) {
                const uniqueTiles = [...new Set(data.cardValues.slice(0, 8))];
                selectedTiles = new Set(uniqueTiles.slice(0, 8));
                updateTileGrid();
                localStorage.setItem('customCardValues', JSON.stringify(data.cardValues));
            }
            
            // Load and display stats
            await loadUserStats(data);
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        showMessage(refs.nicknameMessage, `Error loading data: ${error.message}`, 'error');
    }
}

async function loadUserStats(userData) {
    try {
        // Display user stats
        refs.pairsHighScore.textContent = userData.highScore || 0;
        refs.puzzleBestMoves.textContent = userData.bestPuzzleMoves || 0;
        
        const totalGames = (userData.gamesPlayed || 0) + (userData.puzzleGamesPlayed || 0);
        refs.totalGames.textContent = totalGames;
        
        // Calculate user rank (simplified)
        const rankQuery = query(
            collection(db, "users"), 
            orderBy("highScore", "desc"), 
            limit(100)
        );
        
        const rankSnapshot = await getDocs(rankQuery);
        let rank = 1;
        
        rankSnapshot.forEach((doc, index) => {
            if (doc.id === currentUser.uid) {
                rank = index + 1;
            }
        });
        
        refs.userRank.textContent = `${rank || '-'}`;
        refs.userStats.classList.remove('hidden');
        
    } catch (error) {
        console.error('Error loading user stats:', error);
    }
}

// Event Listeners
function setupEventListeners() {
    // Nickname events
    refs.saveNicknameBtn.addEventListener('click', saveNickname);
    refs.nicknameInput.addEventListener('input', updateNicknameCounter);
    refs.nicknameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveNickname();
    });
    
    // Tile events
    refs.addTileBtn.addEventListener('click', addTile);
    refs.clearTilesBtn.addEventListener('click', clearAllTiles);
    refs.saveCardsBtn.addEventListener('click', saveCards);
    
    refs.tileInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTile();
    });
    
    // Preset buttons
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const preset = e.target.getAttribute('data-preset');
            loadPreset(preset);
        });
    });
    
    // Logout button
    refs.logoutBtn.addEventListener('click', logout);
}

// Authentication State Management
function initializeAuth() {
    onAuthStateChanged(auth, async (user) => {
        refs.authCheck.classList.add('hidden');
        document.body.classList.add('auth-ready');
        
        if (user) {
            currentUser = user;
            refs.loginPrompt.classList.add('hidden');
            refs.inventoryContainer.classList.remove('hidden');
            
            // Initialize the interface
            updateNicknameCounter();
            updateTileGrid();
            
            // Load user data
            await loadUserData();
        } else {
            currentUser = null;
            refs.loginPrompt.classList.remove('hidden');
            refs.inventoryContainer.classList.add('hidden');
        }
    });
}

// Initialize Application
function initApp() {
    setupEventListeners();
    initializeAuth();
}

// Start the application when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
