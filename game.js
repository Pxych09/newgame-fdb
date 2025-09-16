import { auth, db } from './firebase-init.js';
import { 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { 
    collection, 
    doc, 
    addDoc, 
    runTransaction,
    getDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// DOM References
const authCheck = document.getElementById('auth-check');
const loginPrompt = document.getElementById('login-prompt');
const gameContainer = document.getElementById('game-container');
const scoreEl = document.getElementById('score');
const movesEl = document.getElementById('moves');
const pairsEl = document.getElementById('pairs');
const timeEl = document.getElementById('time');
const gameBoard = document.getElementById('game-board');
const newGameBtn = document.getElementById('new-game-btn');
const pauseBtn = document.getElementById('pause-btn');
const modal = document.getElementById('modal');
const finalScoreEl = document.getElementById('final-score');
const playAgainBtn = document.getElementById('play-again-btn');
const closeModalBtn = document.getElementById('close-modal-btn');

// Game state
let currentUser = null;
let timerInterval;
let time = 0;
let moves = 0;
let pairsFound = 0;
let firstCard = null;
let secondCard = null;
let isPaused = false;
let cards = [];
let lockBoard = false;
let gameStarted = false;

// Load custom card values from localStorage, fallback to default
const customCardValues = JSON.parse(localStorage.getItem('customCardValues'));
const cardValues = customCardValues || [1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8];

// Helper function
function getPlayerName(email) {
    return !email ? "Anonymous" : email.split("@")[0];
}

// Shuffle array
function shuffle(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// Create game board
function createBoard() {
    gameBoard.innerHTML = '';
    const shuffledValues = shuffle(cardValues);
    
    shuffledValues.forEach((value, index) => {
        const card = document.createElement('div');
        card.dataset.value = value;
        card.dataset.index = index;
        card.textContent = '?'; // Show placeholder initially
        card.addEventListener('click', flipCard);
        gameBoard.appendChild(card);
    });
    cards = [...gameBoard.children];
}

function resetGame() {
    time = 0;
    moves = 0;
    pairsFound = 0;
    isPaused = false;
    gameStarted = false;
    firstCard = null;
    secondCard = null;
    lockBoard = false;
    
    // Update UI
    scoreEl.textContent = 0;
    movesEl.textContent = 0;
    pairsEl.textContent = '0/8';
    timeEl.textContent = '00:00';
    pauseBtn.textContent = 'Pause';
    
    // Clear timer
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    createBoard();
}

// Flip card logic
function flipCard() {
    if (lockBoard || this === firstCard || this.classList.contains('flipped') || isPaused) {
        return;
    }

    // Start the timer on the first click
    if (!gameStarted) {
        startTimer();
        gameStarted = true;
    }

    // Flip the card
    this.classList.add('flipped');
    this.classList.remove('bg-blue-500', 'hover:bg-blue-600');
    this.classList.add('bg-white', 'text-gray-800', 'border-2', 'border-blue-500');
    this.textContent = this.dataset.value;

    if (!firstCard) {
        firstCard = this;
    } else {
        secondCard = this;
        moves++;
        movesEl.textContent = moves;
        
        // Update score in real-time
        updateScore();
        
        checkMatch();
    }
}

// Check if cards match
function checkMatch() {
    lockBoard = true;
    
    if (firstCard.dataset.value === secondCard.dataset.value) {
        // Match found
        firstCard.classList.add('paired');
        secondCard.classList.add('paired');
        firstCard.classList.remove('bg-white', 'border-blue-500');
        secondCard.classList.remove('bg-white', 'border-blue-500');
        firstCard.classList.add('bg-green-500', 'text-white');
        secondCard.classList.add('bg-green-500', 'text-white');
        
        pairsFound++;
        pairsEl.textContent = `${pairsFound}/8`;
        
        resetFlip();
        
        if (pairsFound === 8) {
            setTimeout(endGame, 500); // Small delay for visual effect
        }
    } else {
        // No match - flip back after delay
        setTimeout(() => {
            firstCard.classList.remove('flipped', 'bg-white', 'text-gray-800', 'border-2', 'border-blue-500');
            firstCard.classList.add('bg-blue-500', 'hover:bg-blue-600', 'text-white');
            firstCard.textContent = '?';
            
            secondCard.classList.remove('flipped', 'bg-white', 'text-gray-800', 'border-2', 'border-blue-500');
            secondCard.classList.add('bg-blue-500', 'hover:bg-blue-600', 'text-white');
            secondCard.textContent = '?';
            
            resetFlip();
        }, 1000);
    }
}

function resetFlip() {
    firstCard = null;
    secondCard = null;
    lockBoard = false;
}

// Start timer
function startTimer() {
    timerInterval = setInterval(() => {
        if (!isPaused) {
            time++;
            const minutes = Math.floor(time / 60).toString().padStart(2, '0');
            const seconds = (time % 60).toString().padStart(2, '0');
            timeEl.textContent = `${minutes}:${seconds}`;
            
            // Update score in real-time
            updateScore();
        }
    }, 1000);
}

// Update score in real-time
function updateScore() {
    const currentScore = calculateScore();
    scoreEl.textContent = currentScore;
}

// Pause/resume game
function togglePause() {
    isPaused = !isPaused;
    pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
    
    if (isPaused) {
        // Hide card values when paused
        cards.forEach(card => {
            if (card.classList.contains('flipped') && !card.classList.contains('paired')) {
                card.style.visibility = 'hidden';
            }
        });
    } else {
        // Show card values when resumed
        cards.forEach(card => {
            card.style.visibility = 'visible';
        });
    }
}

// Calculate score (higher is better)
function calculateScore() {
    const baseScore = 1000;
    const movePenalty = moves * 10;
    const timePenalty = time * 2;
    return Math.max(0, baseScore - movePenalty - timePenalty);
}

// End game and show modal
async function endGame() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    const finalScore = calculateScore();
    finalScoreEl.textContent = finalScore;
    modal.classList.remove('hidden');
    
    // Save score (non-blocking)
    saveGameScore(finalScore).catch(error => {
        console.error("Error saving game score:", error);
    });
}

// Save score to Firestore
// Save score to Firestore - FIXED VERSION
async function saveGameScore(finalScore) {
    if (!currentUser) {
        console.log("No user logged in, skipping score save");
        return;
    }

    try {
        console.log("Saving game score...", { 
            finalScore, 
            moves, 
            time, 
            userId: currentUser.uid,
            userEmail: currentUser.email 
        });

        // First, ensure user document exists and update stats
        const userDocRef = doc(db, "users", currentUser.uid);
        
        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userDocRef);
            
            if (userDoc.exists()) {
                const data = userDoc.data();
                const newGamesPlayed = (data.gamesPlayed || 0) + 1;
                const newHighScore = Math.max(data.highScore || 0, finalScore);
                const newTotalGamesPlayed = newGamesPlayed + (data.puzzleGamesPlayed || 0);
                
                transaction.update(userDocRef, {
                    gamesPlayed: newGamesPlayed,
                    highScore: newHighScore,
                    totalGamesPlayed: newTotalGamesPlayed,
                    lastPlayed: new Date()
                });
                
                console.log("User stats updated - Games played:", newGamesPlayed, "High score:", newHighScore);
            } else {
                // Create new user document if it doesn't exist
                const newUserData = {
                    email: currentUser.email,
                    nickname: '',
                    gamesPlayed: 1,
                    highScore: finalScore,
                    puzzleGamesPlayed: 0,
                    bestPuzzleMoves: 0,
                    bestPuzzleTime: 0,
                    totalGamesPlayed: 1,
                    createdAt: new Date(),
                    lastPlayed: new Date()
                };
                transaction.set(userDocRef, newUserData);
                console.log("New user document created");
            }
        });

        console.log("User stats transaction completed successfully");

        // Now create the game record - with more explicit data
        const gameData = {
            userId: currentUser.uid,
            userEmail: currentUser.email, // Additional field for debugging
            score: finalScore,
            moves: moves,
            time: time,
            gameType: 'pair_matching', // Specify game type
            timestamp: new Date(),
            createdAt: new Date() // Additional timestamp field
        };

        console.log("Creating game document with data:", gameData);
        const docRef = await addDoc(collection(db, "games"), gameData);
        console.log("Game record saved successfully with ID:", docRef.id);

    } catch (error) {
        console.error("Detailed error saving game score:", {
            code: error.code,
            message: error.message,
            userId: currentUser?.uid,
            userEmail: currentUser?.email
        });
        
        // More specific error handling
        if (error.code === 'permission-denied') {
            console.error("Permission denied - check Firebase security rules");
            alert("Unable to save your score due to permission issues. Your game progress is still recorded locally.");
        } else if (error.code === 'unavailable') {
            console.error("Firestore unavailable - network issue");
            alert("Unable to save your score due to network issues. Please check your connection and try again.");
        } else if (error.code === 'unauthenticated') {
            console.error("User not authenticated");
            alert("Please log in again to save your score.");
            window.location.href = 'index.html';
        } else {
            console.error("Unknown error:", error);
            alert("An unexpected error occurred while saving your score. Please try again.");
        }
        
        // Re-throw the error so calling code can handle it
        throw error;
    }
}

// Event listeners
newGameBtn?.addEventListener('click', resetGame);
pauseBtn?.addEventListener('click', togglePause);

playAgainBtn?.addEventListener('click', () => {
    modal.classList.add('hidden');
    resetGame();
});

closeModalBtn?.addEventListener('click', () => {
    modal.classList.add('hidden');
    window.location.href = 'index.html';
});

// Initialize game
window.addEventListener('load', () => {
    onAuthStateChanged(auth, (user) => {
        if (authCheck) authCheck.classList.add('hidden');
        
        if (user) {
            currentUser = user;
            console.log("User authenticated:", user.uid);
            
            if (loginPrompt) loginPrompt.classList.add('hidden');
            if (gameContainer) gameContainer.classList.remove('hidden');
            
            // Update UI with user info
            const nickname = localStorage.getItem('userNickname') || getPlayerName(user.email);
            const userDisplayName = document.getElementById('user-display-name');
            const titleElement = document.querySelector('h1');
            
            if (userDisplayName) userDisplayName.textContent = nickname;
            if (titleElement) titleElement.textContent = `🃏 Cards to Pair - Welcome, ${nickname}!`;
            
            resetGame();
        } else {
            currentUser = null;
            console.log("No user authenticated");
            
            if (loginPrompt) loginPrompt.classList.remove('hidden');
            if (gameContainer) gameContainer.classList.add('hidden');
        }
    });
});
