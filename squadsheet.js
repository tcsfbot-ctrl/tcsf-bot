const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ALLOWED_TEAM_ROLE_NAMES } = require('../config/constants');
const { activeContracts } = require('../systems/contracts');

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

    const rosterMembers = new Map(
      [...teamRole.members.values()].map(member => [
        member.id,
        { id: member.id, username: member.user.username }
      ])
    );

    for (const contract of activeContracts.values()) {
      const belongsToTeam = contract.teamRoleId === teamRole.id ||
        (!contract.teamRoleId && contract.teamName === teamName);
      if (belongsToTeam && contract.signee?.id) {
        rosterMembers.set(contract.signee.id, {
          id: contract.signee.id,
          username: contract.signee.username || contract.signee.id
        });
      }
    }

    const members = [...rosterMembers.values()]
      .sort((a, b) => a.username.localeCompare(b.username));
    const roster = members.length
      ? members.map(member => `• <@${member.id}>`).join('\n')
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
