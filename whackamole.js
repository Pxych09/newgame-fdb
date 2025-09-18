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
const startWhackBtn = document.getElementById('startWhack');
const timerDisplay = document.getElementById('timerWhack');
const scoreDisplay = document.getElementById('scoreWhack');
const hitsDisplay = document.getElementById('hitsWhack');
const missedDisplay = document.getElementById('missedWhack');
const accuracyDisplay = document.getElementById('accuracyWhack');
const dashboardBtn = document.getElementById('dashBoardWhack');
const holes = document.querySelectorAll('.hole');
const moles = document.querySelectorAll('.mole');

// Game Variables
let currentUser = null;
let gameActive = false;
let gameTimer = null;
let moleTimers = [];
let gameTime = 0;
let score = 0;
let hits = 0;
let missed = 0;
let activeMoles = new Set();
let gameDuration = 45000; // 45 seconds for more pressure
let baseMoleDisplayTime = 1200; // Base display time
let moleHideTime = 400; // Faster spawning
let difficultyMultiplier = 1;
let consecutiveHits = 0;
let maxSimultaneousMoles = 1;

// Game Functions
function startGame() {
    if (gameActive) return;
    
    resetGame();
    gameActive = true;
    startWhackBtn.textContent = 'Playing...';
    startWhackBtn.disabled = true;
    startWhackBtn.classList.add('opacity-50', 'cursor-not-allowed');
    
    // Start game timer
    gameTimer = setInterval(updateTimer, 100);
    
    // Start with first mole
    spawnMole();
    
    // Increase difficulty over time
    const difficultyTimer = setInterval(() => {
        if (!gameActive) {
            clearInterval(difficultyTimer);
            return;
        }
        
        difficultyMultiplier += 0.1;
        if (gameTime > 15000) maxSimultaneousMoles = 2; // Multiple moles after 15 seconds
        if (gameTime > 30000) maxSimultaneousMoles = 3; // Even more after 30 seconds
        
    }, 3000);
    
    // End game after duration
    setTimeout(endGame, gameDuration);
}

function resetGame() {
    gameTime = 0;
    score = 0;
    hits = 0;
    missed = 0;
    activeMoles.clear();
    difficultyMultiplier = 1;
    consecutiveHits = 0;
    maxSimultaneousMoles = 1;
    
    // Reset displays
    updateDisplay();
    
    // Hide all moles and reset their states
    moles.forEach((mole, index) => {
        mole.style.transform = 'translateY(100%)';
        mole.style.opacity = '0';
        mole.style.backgroundColor = 'rgb(5, 25, 86)';
        mole.dataset.active = 'false';
    });
    
    // Clear all timers
    if (gameTimer) clearInterval(gameTimer);
    moleTimers.forEach(timer => clearTimeout(timer));
    moleTimers = [];
}

function updateTimer() {
    gameTime += 100;
    const seconds = Math.floor(gameTime / 1000);
    const milliseconds = Math.floor((gameTime % 1000) / 10);
    timerDisplay.textContent = `${seconds.toString().padStart(2, '0')}:${milliseconds.toString().padStart(2, '0')}`;
}

function spawnMole() {
    if (!gameActive) return;
    
    // Always try to maintain active moles up to the limit
    while (gameActive && activeMoles.size < maxSimultaneousMoles) {
        // Find available holes (not currently showing moles)
        const availableIndices = [];
        moles.forEach((mole, index) => {
            if (!activeMoles.has(index)) {
                availableIndices.push(index);
            }
        });
        
        if (availableIndices.length === 0) break;
        
        // Random hole selection from available holes
        const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
        const mole = moles[randomIndex];
        
        // Mark as active
        activeMoles.add(randomIndex);
        mole.dataset.active = 'true';
        
        // Calculate display time based on difficulty
        const displayTime = Math.max(600, baseMoleDisplayTime - (difficultyMultiplier * 50));
        
        // Show mole with animation
        mole.style.transform = 'translateY(0)';
        mole.style.opacity = '1';
        mole.style.transition = 'all 0.15s cubic-bezier(0.68, -0.55, 0.265, 1.55)'; // Bouncy effect
        
        // Hide mole after display time
        const hideTimer = setTimeout(() => {
            if (activeMoles.has(randomIndex) && gameActive) {
                hideMole(randomIndex, true); // true = missed
                // Try to spawn a new mole immediately after one disappears
                setTimeout(() => {
                    if (gameActive) spawnMole();
                }, 100);
            }
        }, displayTime);
        
        moleTimers.push(hideTimer);
    }
    
    // Schedule next spawn attempt
    const nextSpawnTime = Math.max(300, moleHideTime - (difficultyMultiplier * 20));
    const spawnTimer = setTimeout(() => {
        if (gameActive) spawnMole();
    }, nextSpawnTime);
    
    moleTimers.push(spawnTimer);
}

function hideMole(moleIndex, wasMissed = false) {
    if (!activeMoles.has(moleIndex)) return;
    
    const mole = moles[moleIndex];
    
    // Hide mole with animation
    mole.style.transform = 'translateY(100%)';
    mole.style.opacity = '0';
    mole.style.transition = 'all 0.2s ease-in';
    mole.dataset.active = 'false';
    
    // Remove from active moles
    activeMoles.delete(moleIndex);
    
    if (wasMissed) {
        missed++;
        consecutiveHits = 0; // Reset combo
        updateDisplay();
    }
}

function whackMole(clickedHole) {
    if (!gameActive) return;
    
    const clickedMole = clickedHole.querySelector('.mole');
    const holeIndex = Array.from(holes).indexOf(clickedHole);
    
    // Check if this mole is currently active/visible
    if (activeMoles.has(holeIndex) && clickedMole.dataset.active === 'true') {
        // Hit! Calculate score with combo bonus
        hits++;
        consecutiveHits++;
        
        let basePoints = 10;
        let comboBonus = Math.min(consecutiveHits - 1, 10) * 2; // Max 20 bonus points
        let speedBonus = Math.floor(difficultyMultiplier * 2); // Bonus for higher difficulty
        
        let totalPoints = basePoints + comboBonus + speedBonus;
        score += totalPoints;
        
        // Visual feedback for hit
        clickedMole.style.backgroundColor = '#10b981'; // Green flash for hit
        clickedMole.style.transform = 'translateY(0) scale(1.2)'; // Slight grow effect
        
        // Show score popup
        showScorePopup(clickedHole, totalPoints, consecutiveHits);
        
        setTimeout(() => {
            clickedMole.style.backgroundColor = 'rgb(5, 25, 86)';
            clickedMole.style.transform = 'translateY(100%) scale(1)';
        }, 200);
        
        hideMole(holeIndex, false); // false = not missed
        updateDisplay();
        
        // Try to spawn a new mole quickly after hit
        setTimeout(() => {
            if (gameActive) spawnMole();
        }, 100);
        
    } else {
        // Miss - clicked wrong hole or inactive mole
        consecutiveHits = 0; // Reset combo on miss
        
        // Visual feedback for miss
        clickedHole.style.backgroundColor = '#f59e0b'; // Orange flash
        setTimeout(() => {
            clickedHole.style.backgroundColor = '#f2f2f2';
        }, 200);
        
        updateDisplay();
    }
}

function showScorePopup(hole, points, combo) {
    const popup = document.createElement('div');
    popup.className = 'absolute text-green-400 font-bold text-sm pointer-events-none z-10';
    popup.style.left = '50%';
    popup.style.top = '10%';
    popup.style.transform = 'translate(-50%, -50%)';
    popup.style.animation = 'float-up 0.8s ease-out forwards';
    
    let text = `+${points}`;
    if (combo > 1) text += ` (x${combo})`;
    popup.textContent = text;
    
    hole.style.position = 'relative';
    hole.appendChild(popup);
    
    setTimeout(() => {
        if (popup.parentNode) {
            popup.parentNode.removeChild(popup);
        }
    }, 800);
}

// Add CSS animation for score popup
const style = document.createElement('style');
style.textContent = `
    @keyframes float-up {
        0% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
        }
        100% {
            opacity: 0;
            transform: translate(-50%, -200%) scale(0.8);
        }
    }
    .mole {
        transition: all 0.15s cubic-bezier(0.68, -0.55, 0.265, 1.55) !important;
    }
`;
document.head.appendChild(style);

function updateDisplay() {
    scoreDisplay.textContent = score;
    hitsDisplay.textContent = hits;
    missedDisplay.textContent = missed;
    
    const totalAttempts = hits + missed;
    const accuracy = totalAttempts > 0 ? Math.round((hits / totalAttempts) * 100) : 0;
    accuracyDisplay.textContent = totalAttempts > 0 ? `${accuracy}%` : '-';
    
    // Add combo indicator to score display if there's a combo
    if (consecutiveHits > 1 && gameActive) {
        scoreDisplay.innerHTML = `${score} <span class="text-green-400 text-xs">(x${consecutiveHits})</span>`;
    }
}

function endGame() {
    gameActive = false;
    clearInterval(gameTimer);
    moleTimers.forEach(timer => clearTimeout(timer));
    moleTimers = [];
    
    // Hide all active moles
    activeMoles.forEach(moleIndex => {
        hideMole(moleIndex, false);
    });
    
    // Reset button
    startWhackBtn.textContent = 'Start';
    startWhackBtn.disabled = false;
    startWhackBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    
    // Calculate final stats
    const totalAttempts = hits + missed;
    const accuracy = totalAttempts > 0 ? Math.round((hits / totalAttempts) * 100) : 0;
    const avgPointsPerHit = hits > 0 ? Math.round(score / hits) : 0;
    
    // Show comprehensive final score
    setTimeout(() => {
        alert(`🎯 Game Over!\n\n` +
              `Final Score: ${score} points\n` +
              `Hits: ${hits} | Missed: ${missed}\n` +
              `Accuracy: ${accuracy}%\n` +
              `Average Points/Hit: ${avgPointsPerHit}\n` +
              `Best Combo: ${Math.max(consecutiveHits, 0)}x`);
    }, 500);
    
    // Optional: Save score to Firebase
    if (currentUser) {
        saveScoreToDatabase(score);
    }
}

// Save score to Firebase Firestore with user stats tracking
async function saveScoreToDatabase(finalScore) {
    if (!currentUser) {
        console.log("No user logged in, skipping score save");
        return;
    }

    try {
        console.log("Saving whack-a-mole score...", { 
            finalScore, 
            hits, 
            missed,
            accuracy: Math.round((hits / (hits + missed)) * 100) || 0,
            userId: currentUser.uid,
            userEmail: currentUser.email 
        });

        // First, ensure user document exists and update stats
        const userDocRef = doc(db, "users", currentUser.uid);
        
        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userDocRef);
            
            if (userDoc.exists()) {
                const data = userDoc.data();
                const newWhackamoleGamesPlayed = (data.whackamoleGamesPlayed || 0) + 1;
                const newWhackamoleHighScore = Math.max(data.whackamoleHighScore || 0, finalScore);
                const newTotalGamesPlayed = (data.gamesPlayed || 0) + (data.puzzleGamesPlayed || 0) + newWhackamoleGamesPlayed;
                
                transaction.update(userDocRef, {
                    whackamoleGamesPlayed: newWhackamoleGamesPlayed,
                    whackamoleHighScore: newWhackamoleHighScore,
                    totalGamesPlayed: newTotalGamesPlayed,
                    lastPlayed: new Date()
                });
                
                console.log("User stats updated - Whackamole games played:", newWhackamoleGamesPlayed, "High score:", newWhackamoleHighScore);
            } else {
                // Create new user document if it doesn't exist
                const nickname = localStorage.getItem('userNickname') || getPlayerName(currentUser.email);
                const newUserData = {
                    email: currentUser.email,
                    nickname: nickname,
                    gamesPlayed: 0,
                    highScore: 0,
                    puzzleGamesPlayed: 0,
                    bestPuzzleMoves: 0,
                    bestPuzzleTime: 0,
                    whackamoleGamesPlayed: 1,
                    whackamoleHighScore: finalScore,
                    totalGamesPlayed: 1,
                    createdAt: new Date(),
                    lastPlayed: new Date()
                };
                transaction.set(userDocRef, newUserData);
                console.log("New user document created");
            }
        });

        console.log("User stats transaction completed successfully");

        // Now create the whack-a-mole score record - with comprehensive data
        const nickname = localStorage.getItem('userNickname') || getPlayerName(currentUser.email);
        const scoreData = {
            userId: currentUser.uid,
            userEmail: currentUser.email, // Additional field for debugging
            nickname: nickname,
            score: finalScore,
            hits: hits,
            missed: missed,
            accuracy: Math.round((hits / (hits + missed)) * 100) || 0,
            gameType: 'whackamole', // Specify game type
            timestamp: new Date(),
            createdAt: new Date() // Additional timestamp field
        };

        console.log("Creating whack-a-mole score document with data:", scoreData);
        const docRef = await addDoc(collection(db, "whackamole_scores"), scoreData);
        console.log("Whack-a-mole score saved successfully with ID:", docRef.id);

    } catch (error) {
        console.error("Detailed error saving whack-a-mole score:", {
            code: error.code,
            message: error.message,
            userId: currentUser?.uid,
            userEmail: currentUser?.email,
            score: finalScore,
            hits: hits,
            missed: missed
        });
        
        // More specific error handling
        if (error.code === 'permission-denied') {
            console.error("Permission denied - check Firebase security rules");
            alert("Unable to save your whack-a-mole score due to permission issues. Your game progress is still recorded locally.");
        } else if (error.code === 'unavailable') {
            console.error("Firestore unavailable - network issue");
            alert("Unable to save your score due to network issues. Please check your connection and try again.");
        } else if (error.code === 'unauthenticated') {
            console.error("User not authenticated");
            alert("Please log in again to save your score.");
            window.location.href = 'index.html';
        } else {
            console.error("Unknown error:", error);
            alert("An unexpected error occurred while saving your whack-a-mole score. Please try again.");
        }
        
        // Re-throw the error so calling code can handle it
        throw error;
    }
}

// Event Listeners
holes.forEach(hole => {
    hole.addEventListener('click', () => whackMole(hole));
    hole.addEventListener('mousedown', (e) => e.preventDefault()); // Prevent text selection
});

// Keyboard controls (spacebar to start)
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !gameActive) {
        e.preventDefault();
        startGame();
    }
});

// Navigation Functions
function navigateToPage(url) {
    window.location.href = url;
}


// Check auth on load
window.addEventListener('load', () => {
    onAuthStateChanged(auth, (user) => {
        authCheck.classList.add('hidden');
        if (user) {
            currentUser = user;
            const nickname = localStorage.getItem('userNickname') || getPlayerName(user.email);
            document.getElementById('usernameDisplay').textContent = nickname;
            
            // Initialize game
            updateDisplay();
            dashboardBtn.addEventListener("click", () => navigateToPage('index.html'));
            startWhackBtn.addEventListener("click", (e) => {
                e.preventDefault();
                startGame();
            });
        }
    });
});

function getPlayerName(email) {
    return email.split('@')[0];
}
