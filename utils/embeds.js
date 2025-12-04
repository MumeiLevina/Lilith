const { EmbedBuilder } = require('discord.js');

function createRoleplayEmbed(characterName, content, appearance) {
    return new EmbedBuilder()
        .setColor('#FF9DD1')
        .setTitle(characterName)
        .setDescription(content)
        .setFooter({ text: `Character: ${characterName}` })
        .setTimestamp();
}

module.exports = { createRoleplayEmbed };