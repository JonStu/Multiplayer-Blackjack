class BlackjackHelp {
    constructor() {
        this.sections = {
            basics: {
                title: "Basic Rules",
                content: `
                    • The goal is to beat the dealer's hand without going over 21
                    • Card values: 
                        - Number cards (2-10) are worth their face value
                        - Face cards (Jack, Queen, King) are worth 10
                        - Aces are worth 1 or 11, whichever is more advantageous
                    • Each player starts with two cards
                    • "Hit" to take another card, "Stand" to keep your current hand
                    • Going over 21 is a "bust" and results in a loss
                `
            },
            actions: {
                title: "Player Actions",
                content: `
                    • Hit: Take another card
                    • Stand: Keep your current hand
                    • Double Down: Double your bet and take exactly one more card
                    • Split: If you have two cards of the same value, separate them into two hands
                `
            },
            strategy: {
                title: "Basic Strategy",
                content: `
                    • Stand when your hand is 12-16 and the dealer has 2-6
                    • Hit when your hand is 12-16 and the dealer has 7 or higher
                    • Always hit on 11 or below
                    • Always stand on 17 or above
                    • Split Aces and 8s
                    • Double down on 11, unless dealer shows an Ace
                `
            }
        };
    }

    showHelp() {
        const modal = document.createElement('div');
        modal.className = 'help-modal';
        modal.innerHTML = `
            <div class="help-content">
                <h2>How to Play Blackjack</h2>
                <div class="help-sections">
                    ${Object.values(this.sections).map(section => `
                        <div class="help-section">
                            <h3>${section.title}</h3>
                            <pre>${section.content}</pre>
                        </div>
                    `).join('')}
                </div>
                <button class="close-help">Close</button>
            </div>
        `;

        document.body.appendChild(modal);

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .help-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.85);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000;
            }
            .help-content {
                background: var(--primary-color);
                color: var(--text-color);
                padding: 25px;
                border-radius: 10px;
                max-width: 800px;
                max-height: 80vh;
                overflow-y: auto;
                position: relative;
                border: 2px solid var(--accent-color);
                box-shadow: 0 0 20px rgba(212, 175, 55, 0.3);
            }
            .help-content h2 {
                color: var(--accent-color);
                text-align: center;
                margin-bottom: 20px;
                font-size: 24px;
            }
            .help-section {
                margin-bottom: 25px;
                background: var(--secondary-color);
                border-radius: 8px;
                padding: 15px;
            }
            .help-section h3 {
                color: var(--accent-color);
                border-bottom: 2px solid var(--accent-color);
                padding-bottom: 8px;
                margin-bottom: 15px;
            }
            .help-section pre {
                white-space: pre-wrap;
                font-family: inherit;
                margin: 0;
                padding: 15px;
                background: var(--dark-green);
                border-radius: 5px;
                color: var(--text-color);
                line-height: 1.5;
            }
            .close-help {
                position: absolute;
                top: 15px;
                right: 15px;
                padding: 8px 20px;
                background: var(--accent-color);
                color: var(--primary-color);
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-weight: bold;
                transition: all 0.3s ease;
            }
            .close-help:hover {
                background: #c19b2f;
                transform: translateY(-2px);
            }
            /* Custom scrollbar for the modal */
            .help-content::-webkit-scrollbar {
                width: 10px;
            }
            .help-content::-webkit-scrollbar-track {
                background: var(--dark-green);
                border-radius: 5px;
            }
            .help-content::-webkit-scrollbar-thumb {
                background: var(--accent-color);
                border-radius: 5px;
            }
            .help-content::-webkit-scrollbar-thumb:hover {
                background: #c19b2f;
            }
        `;
        document.head.appendChild(style);

        // Add close functionality
        const closeButton = modal.querySelector('.close-help');
        closeButton.onclick = () => {
            modal.remove();
        };
    }
}

// Create global instance
window.blackjackHelp = new BlackjackHelp();
