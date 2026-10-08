const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ALLOWED_TEAM_ROLE_NAMES } = require('../config/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('squadsheet')
    .setDescription('Mostra o elenco de um time com as menções dos jogadores.')
    .addStringOption(option =>
      option.setName('time')
        .setDescription('Time cujo elenco deseja consultar')
        .setRequired(true)
        .addChoices(...ALLOWED_TEAM_ROLE_NAMES.map(name => ({ name, value: name })))
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const teamName = interaction.options.getString('time');
    const teamRole = interaction.guild.roles.cache.find(role => role.name === teamName);

    if (!teamRole) {
      return interaction.editReply({
        content: `❌ Não encontrei o cargo do time **${teamName}** neste servidor.`
      });
    }

    const members = [...teamRole.members.values()]
      .sort((a, b) => a.user.username.localeCompare(b.user.username));
    const roster = members.length
      ? members.map(member => `• ${member}`).join('\n')
      : 'Nenhum jogador está no elenco deste time.';

    const embed = new EmbedBuilder()
      .setColor(teamRole.color || 0x5865f2)
      .setTitle(`📋 Elenco — ${teamName}`)
      .setDescription(roster)
      .setFooter({ text: `${members.length} jogador(es)` })
      .setTimestamp();

    return interaction.editReply({
      embeds: [embed],
      allowedMentions: { parse: [] }
    });
  }
};
