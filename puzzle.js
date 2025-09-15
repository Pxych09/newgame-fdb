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
const puzzleContainer = document.getElementById('puzzle-container');
const puzzleBoard = document.getElementById('puzzle-board');
const movesEl = document.getElementById('moves');
const timeEl = document.getElementById('time');
const newPuzzleBtn = document.getElementById('new-puzzle-btn');
const backBtn = document.getElementById('back-btn');

let currentUser = null;
let timerInterval;
let time = 0;
let moves = 0;
let tiles = [];

// Initialize 3x3 puzzle with numbers 1-8 and one empty space (0)
function createPuzzle() {
    // Start with solved state then shuffle to ensure solvability
    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 0];
    
    // Shuffle with solvability check
    do {
        for (let i = numbers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
        }
    } while (!isSolvable(numbers) || isSolved(numbers));
    
    puzzleBoard.innerHTML = '';
    puzzleBoard.className = 'grid grid-cols-3 gap-2 w-64 h-64 mx-auto'; // 3x3 grid
    tiles = [];
    
    numbers.forEach(num => {
        const tile = document.createElement('div');
        tile.classList.add('bg-blue-200', 'rounded-md', 'flex', 'items-center', 'justify-center', 'text-2xl', 'font-bold', 'cursor-pointer', 'select-none', 'transition-colors', 'hover:bg-blue-300', 'text-shadow-md');
        tile.textContent = num === 0 ? '' : num;
        tile.dataset.value = num;
        if (num === 0) {
            tile.classList.add('bg-gray-100');
        }
        tile.addEventListener('click', moveTile);
        puzzleBoard.appendChild(tile);
        tiles.push(tile);
    });
    
    moves = 0;
    movesEl.textContent = moves;
    time = 0;
    timeEl.textContent = '00:00';
    clearInterval(timerInterval);
}

// Check if puzzle configuration is solvable
function isSolvable(arr) {
    let inversions = 0;
    for (let i = 0; i < arr.length - 1; i++) {
        for (let j = i + 1; j < arr.length; j++) {
            if (arr[i] > arr[j] && arr[i] !== 0 && arr[j] !== 0) {
                inversions++;
            }
        }
    }
    return inversions % 2 === 0;
}

// Check if puzzle is already solved
function isSolved(arr) {
    for (let i = 0; i < arr.length - 1; i++) {
        if (arr[i] !== i + 1) return false;
    }
    return arr[arr.length - 1] === 0;
}

function startTimer() {
    timerInterval = setInterval(() => {
        time++;
        const minutes = Math.floor(time / 60).toString().padStart(2, '0');
        const seconds = (time % 60).toString().padStart(2, '0');
        timeEl.textContent = `${minutes}:${seconds}`;
    }, 1000);
}

function moveTile() {
    if (!timerInterval) startTimer(); // Start timer on first move
    const index = tiles.indexOf(this);
    const emptyIndex = tiles.findIndex(tile => tile.dataset.value === '0');

    const row = Math.floor(index / 3); // Changed to 3 for 3x3 grid
    const col = index % 3;
    const emptyRow = Math.floor(emptyIndex / 3);
    const emptyCol = emptyIndex % 3;

    if ((Math.abs(row - emptyRow) === 1 && col === emptyCol) || 
        (Math.abs(col - emptyCol) === 1 && row === emptyRow)) {
        
        moves++;
        movesEl.textContent = moves;
        
        // Swap values and content
        [tiles[index].dataset.value, tiles[emptyIndex].dataset.value] = 
            [tiles[emptyIndex].dataset.value, tiles[index].dataset.value];
        [tiles[index].textContent, tiles[emptyIndex].textContent] = 
            [tiles[emptyIndex].textContent, tiles[index].textContent];
        
        // Update styling
        if (tiles[index].dataset.value === '0') {
            tiles[index].classList.add('bg-gray-100');
            tiles[index].classList.remove('bg-blue-200');
        } else {
            tiles[index].classList.add('bg-blue-200');
            tiles[index].classList.remove('bg-gray-100');
        }
        
        if (tiles[emptyIndex].dataset.value === '0') {
            tiles[emptyIndex].classList.add('bg-gray-100');
            tiles[emptyIndex].classList.remove('bg-blue-200');
        } else {
            tiles[emptyIndex].classList.add('bg-blue-200');
            tiles[emptyIndex].classList.remove('bg-gray-100');
        }
        
        checkWin();
    }
}

function checkWin() {
    // Check if tiles are in correct order: 1,2,3,4,5,6,7,8,0
    const isSolved = tiles.every((tile, i) => {
        const expectedValue = i < 8 ? i + 1 : 0;
        return parseInt(tile.dataset.value) === expectedValue;
    });
    
    if (isSolved) {
        clearInterval(timerInterval);
        savePuzzleScore();
        
        // Celebration effect
        tiles.forEach(tile => {
            if (tile.dataset.value !== '0') {
                tile.classList.add('bg-green-300');
            }
        });
        
        setTimeout(() => {
            alert(`🎉 Puzzle solved!\n⏱️ Time: ${timeEl.textContent}\n🎯 Moves: ${moves}\n\nScore saved!`);
        }, 500);
    }
}

async function savePuzzleScore() {
    if (!currentUser) {
        console.warn("No current user, cannot save score");
        return;
    }

    // Validate data before saving
    if (typeof moves !== 'number' || typeof time !== 'number' || moves < 0 || time < 0) {
        console.error("Invalid game data:", { moves, time });
        return;
    }

    try {
        console.log("Saving puzzle score...", { moves, time, userId: currentUser.uid });
        
        const userDocRef = doc(db, "users", currentUser.uid);
        const gamesRef = collection(db, "puzzle_games");

        // Save the game record
        const gameData = {
            userId: currentUser.uid,
            moves: Number(moves),
            time: Number(time),
            timestamp: new Date(),
            gridSize: '3x3'
        };

        const gameDocRef = await addDoc(gamesRef, gameData);
        console.log("Game record saved with ID:", gameDocRef.id);

        // Update user stats in a transaction
        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userDocRef);
            
            if (userDoc.exists()) {
                const data = userDoc.data();
                const newGamesPlayed = (data.puzzleGamesPlayed || 0) + 1;
                const currentBestMoves = data.bestPuzzleMoves || Infinity;
                const currentBestTime = data.bestPuzzleTime || Infinity;
                const newBestMoves = Math.min(currentBestMoves, moves);
                const newBestTime = Math.min(currentBestTime, time);
                
                const updateData = {
                    puzzleGamesPlayed: newGamesPlayed,
                    bestPuzzleMoves: newBestMoves,
                    bestPuzzleTime: newBestTime,
                    lastPlayed: new Date()
                };
                
                transaction.update(userDocRef, updateData);
                console.log("User stats updated:", updateData);
            } else {
                // Create user document if it doesn't exist
                const newUserData = {
                    puzzleGamesPlayed: 1,
                    bestPuzzleMoves: moves,
                    bestPuzzleTime: time,
                    lastPlayed: new Date(),
                    createdAt: new Date()
                };
                
                transaction.set(userDocRef, newUserData);
                console.log("New user document created:", newUserData);
            }
        });
        
        console.log("Puzzle score saved successfully!");
        
    } catch (error) {
        console.error("Error saving puzzle score:", error);
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);
        
        // Show user-friendly error message
        if (error.code === 'permission-denied') {
            alert("Unable to save score: Permission denied. Please check your login status.");
        } else if (error.code === 'unavailable') {
            alert("Unable to save score: Service temporarily unavailable. Please try again later.");
        } else {
            alert("Unable to save score. Please check your internet connection and try again.");
        }
    }
}

// Event Listeners
newPuzzleBtn.addEventListener('click', createPuzzle);
backBtn.addEventListener('click', () => window.location.href = 'index.html');

// Check auth on load
window.addEventListener('load', () => {
    onAuthStateChanged(auth, (user) => {
        authCheck.classList.add('hidden');
        if (user) {
            currentUser = user;
            loginPrompt.classList.add('hidden');
            puzzleContainer.classList.remove('hidden');
            const nickname = localStorage.getItem('userNickname') || getPlayerName(user.email);
            document.getElementById('user-display-name').textContent = nickname;
            document.querySelector('h1').textContent = `🧩 Number Puzzle - Welcome, ${nickname}!`;
            createPuzzle();
        } else {
            loginPrompt.classList.remove('hidden');
            puzzleContainer.classList.add('hidden');
        }
    });
});

function getPlayerName(email) {
    return !email ? "Anonymous" : email.split("@")[0];
}
