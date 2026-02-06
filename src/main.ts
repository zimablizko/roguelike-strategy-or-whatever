import { Game } from './game';

/**
 * Main entry point for the game
 */
async function main() {
  const game = new Game();

  try {
    await game.start();
    console.log('Game started successfully!');
  } catch (error) {
    console.error('Failed to start game:', error);
  }
}

// Start the game
main();
