import { auth } from './firebase-init.js';
import { 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { 
    collection, 
    doc, 
    addDoc, 
    runTransaction, 
    getFirestore 
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
const db = getFirestore();

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
let gameStarted = false; // New flag to track if the game has started

// Load custom card values from localStorage, fallback to default
const customCardValues = JSON.parse(localStorage.getItem('customCardValues'));
const cardValues = customCardValues || [1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8];

// Shuffle array
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Create game board
function createBoard() {
    gameBoard.innerHTML = '';
    const shuffledValues = shuffle([...cardValues]);
    shuffledValues.forEach((value, index) => {
        const card = document.createElement('div');
        card.classList.add('rounded-md', 'p-4', 'text-center', 'cursor-pointer', 'select-none', 'transition-transform', 'text-shadow-lg');
        card.dataset.value = value;
        card.dataset.index = index;
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
    scoreEl.textContent = 0;
    movesEl.textContent = 0;
    pairsEl.textContent = '0/8';
    timeEl.textContent = '00:00';
    pauseBtn.textContent = 'Pause';
    clearInterval(timerInterval);
    createBoard();
}

// Flip card logic (start timer on first click)
function flipCard() {
    if (lockBoard || this === firstCard || this.classList.contains('flipped')) return;

    // Start the timer on the first click if not already started
    if (!gameStarted) {
        startTimer();
        gameStarted = true;
    }

    this.classList.add('flipped');
    this.textContent = this.dataset.value;

    if (!firstCard) {
        firstCard = this;
    } else {
        secondCard = this;
        moves++;
        movesEl.textContent = moves;
        checkMatch();
    }
}

// Check if cards match
function checkMatch() {
    lockBoard = true;
    if (firstCard.dataset.value === secondCard.dataset.value) {

        setTimeout(() => { firstCard.classList.add('paired'); secondCard.classList.add('paired'); }, 0)

        firstCard.classList.add('paired');
        secondCard.classList.add('paired');
        pairsFound++;
        pairsEl.textContent = `${pairsFound}/8`;
        resetFlip();
        if (pairsFound === 8) {
            endGame();
        }
    } else {
        setTimeout(() => {
            firstCard.classList.remove('flipped');
            firstCard.textContent = '';
            secondCard.classList.remove('flipped');
            secondCard.textContent = '';
            firstCard.classList.remove('paired');
            secondCard.classList.remove('paired');
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
        }
    }, 1000);
}

// Pause/resume game
function togglePause() {
    isPaused = !isPaused;
    pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
    if (isPaused) {
        cards.forEach(card => card.removeEventListener('click', flipCard));
    } else {
        cards.forEach(card => card.addEventListener('click', flipCard));
    }
}

// Calculate score (e.g., base 1000 minus moves and time penalties)
function calculateScore() {
    return Math.max(0, 1000 - (moves * 10) - (time * 2));
}

// End game and show modal
async function endGame() {
    clearInterval(timerInterval);
    const finalScore = calculateScore();
    finalScoreEl.textContent = finalScore;
    modal.classList.remove('hidden');
    await saveGameScore(finalScore);
}

// Save score to Firestore
async function saveGameScore(finalScore) {
    if (!currentUser) return;

    try {
        const userDocRef = doc(db, "users", currentUser.uid);
        const gamesRef = collection(db, "games");

        await addDoc(gamesRef, {
            userId: currentUser.uid,
            score: finalScore,
            moves: moves,
            time: time,
            timestamp: new Date()
        });

        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userDocRef);
            if (userDoc.exists()) {
                const data = userDoc.data();
                const newGamesPlayed = (data.gamesPlayed || 0) + 1;
                const newHighScore = Math.max(data.highScore || 0, finalScore);
                transaction.update(userDocRef, {
                    gamesPlayed: newGamesPlayed,
                    highScore: newHighScore
                });
            }
        });
    } catch (error) {
        console.error("Error saving game score:", error);
    }
}

// Event listeners
newGameBtn.addEventListener('click', resetGame);
pauseBtn.addEventListener('click', togglePause);
playAgainBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    resetGame();
});
closeModalBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    window.location.href = 'index.html';
});

window.addEventListener('load', () => {
    onAuthStateChanged(auth, (user) => {
        authCheck.classList.add('hidden');
        if (user) {
            currentUser = user;
            loginPrompt.classList.add('hidden');
            gameContainer.classList.remove('hidden');
            resetGame();
            // Update nickname display
            const nickname = localStorage.getItem('userNickname') || getPlayerName(user.email);
            document.getElementById('user-display-name').textContent = nickname;
            document.querySelector('h1').textContent = `🃏 Cards to Pair - Welcome, ${nickname}!`;
        } else {
            loginPrompt.classList.remove('hidden');
            gameContainer.classList.add('hidden');
        }
    });
});

// Helper function (moved from dashboard.js for reuse)
function getPlayerName(email) {
    return !email ? "Anonymous" : email.split("@")[0];
}
