const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

const discordToken = process.env.DISCORD_TOKEN;
const applicationId = process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID;

const commands = [];
const commandsPath = path.join(__dirname, 'command');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
    } else {
        console.log(`[WARNING] Command at ${filePath} is missing required properties.`);
    }
}

if (!discordToken) {
    console.error('Missing DISCORD_TOKEN in environment. Please set it in .env before deploying commands.');
    process.exit(1);
}

if (!applicationId) {
    console.error('Missing DISCORD_CLIENT_ID (or legacy CLIENT_ID) in environment. Please set it in .env before deploying commands.');
    process.exit(1);
}

const rest = new REST().setToken(discordToken);

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        const data = await rest.put(
            Routes.applicationCommands(applicationId),
            { body: commands },
        );

        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
})();
