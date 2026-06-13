{
  "name": "mumei-levina-bot",
  "version": "1.0.0",
  "description": "A Discord bot with roleplay capabilities using OpenAI API",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js",
    "deploy-commands": "node deploy-commands.js"
  },
  "dependencies": {
    "discord.js": "^14.11.0",
    "dotenv": "^16.0.3",
    "mongoose": "^7.2.1",
    "openai": "^3.2.1"
  },
  "devDependencies": {
    "nodemon": "^2.0.22"
  },
  "engines": {
    "node": ">=16.9.0"
  }
}