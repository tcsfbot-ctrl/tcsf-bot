const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const {
  ALLOWED_RESULT_ROLES,
  ALLOWED_TEAM_ROLE_NAMES,
  RESULT_DRAFT_CHANNEL_ID
} = require('../config/constants');

const data = new SlashCommandBuilder()
  .setName('result')
  .setDescription('Publica o resultado de uma partida (apenas officials).')
  .addStringOption(option =>
    option.setName('home')
      .setDescription('Time mandante')
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addStringOption(option =>
    option.setName('away')
      .setDescription('Time visitante')
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addStringOption(option =>
    option.setName('competicao')
      .setDescription('Competição da partida')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('fase')
      .setDescription('Fase da competição')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('resultado')
      .setDescription('Placar da partida (ex.: 2-1)')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('estadio')
      .setDescription('Estádio da partida')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('officials')
      .setDescription('Officials extras para mencionar (ex.: @user1 @user2)')
      .setRequired(false)
  )
  .addStringOption(option =>
    option.setName('leg')
      .setDescription('Perna da partida, se for ida e volta')
      .setRequired(false)
      .addChoices(
        { name: '1st Leg', value: '1st Leg' },
        { name: '2nd Leg', value: '2nd Leg' }
      )
  )
  .addStringOption(option =>
    option.setName('agregado')
      .setDescription('Placar agregado (ex.: 1-4), se for ida e volta')
      .setRequired(false)
  );

for (let index = 1; index <= 10; index += 1) {
  data.addStringOption(option =>
    option.setName(`subs${index}`)
      .setDescription(`Substituto ${index}`)
      .setRequired(false)
  );
}

data.addStringOption(option =>
  option.setName('statistics')
    .setDescription('Elenco e eventos da partida em texto (gols, cartões, minutos etc.)')
    .setRequired(false)
);

module.exports = {
  data,

  async autocomplete(interaction) {
    const guild = interaction.guild;
    if (!guild) {
      return interaction.respond([]);
    }

    const focusedValue = interaction.options.getFocused().toLowerCase();
    const roles = await guild.roles.fetch();
    const choices = roles
      .filter(role => ALLOWED_TEAM_ROLE_NAMES.includes(role.name))
      .map(role => role.name)
      .filter(name => name.toLowerCase().includes(focusedValue))
      .slice(0, 25);

    await interaction.respond(choices.map(name => ({ name, value: name })));
  },

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const memberRoles = interaction.member?.roles?.cache;
    const hasPermission = memberRoles &&
      ALLOWED_RESULT_ROLES.some(roleId => memberRoles.has(roleId));
    if (!hasPermission) {
      return interaction.editReply({
        content: '❌ Você não tem permissão para usar este comando.'
      });
    }

    const homeName = interaction.options.getString('home');
    const awayName = interaction.options.getString('away');
    const homeRole = interaction.guild?.roles.cache.find(role => role.name === homeName);
    const awayRole = interaction.guild?.roles.cache.find(role => role.name === awayName);

    if (!homeRole || !awayRole ||
      !ALLOWED_TEAM_ROLE_NAMES.includes(homeRole.name) ||
      !ALLOWED_TEAM_ROLE_NAMES.includes(awayRole.name)) {
      return interaction.editReply({
        content: '❌ Um dos cargos de time selecionados não existe mais. Selecione os times novamente.'
      });
    }

    if (homeRole.id === awayRole.id) {
      return interaction.editReply({
        content: '❌ Os times mandante e visitante precisam ser diferentes.'
      });
    }

    const officialsInput = interaction.options.getString('officials')?.trim() ?? '';
    const officialsMentions = officialsInput.match(/<@!?(\d+)>/g) ?? [];
    if (officialsInput && officialsInput.replace(/<@!?\d+>/g, '').trim()) {
      return interaction.editReply({
        content: '❌ No campo officials, mencione apenas os officials extras.'
      });
    }

    const officialIds = [...new Set([
      interaction.user.id,
      ...officialsMentions.map(mention => mention.match(/\d+/)[0])
    ])];
    const officials = officialIds.map(id => `<@${id}>`);
    const leg = interaction.options.getString('leg');
    const aggregate = interaction.options.getString('agregado');
    const substitutes = Array.from({ length: 10 }, (_, index) => ({
      number: index + 1,
      name: interaction.options.getString(`subs${index + 1}`)?.trim()
    })).filter(substitute => substitute.name);
    const statistics = interaction.options.getString('statistics')?.trim();
    const matchDetails = [
      '🏆 RASCUNHO DE RESULTADO',
      `**Partida:** ${homeRole.name} ${interaction.options.getString('resultado')} ${awayRole.name}`,
      `**Gols/placar:** ${interaction.options.getString('resultado')}`,
      `**Competição:** ${interaction.options.getString('competicao')}`,
      `**Fase:** ${interaction.options.getString('fase')}`,
      `**Estádio:** ${interaction.options.getString('estadio')}`,
      ...(leg ? [`**Leg:** ${leg}`] : []),
      ...(aggregate ? [`**Agregado:** ${aggregate}`] : []),
      ...(substitutes.length
        ? ['', '**SUBS**', ...substitutes.map(substitute => `**${substitute.number}.** ${substitute.name}`)]
        : []),
      ...(statistics ? ['', '**STATISTICS**', statistics] : []),
      `**Officials:** ${officials.join(' ')}`
    ];
    const messageContent = matchDetails.join('\n');
    if (messageContent.length > 2000) {
      return interaction.editReply({
        content: '❌ O rascunho ultrapassa o limite de 2.000 caracteres do Discord. Reduza o texto de `statistics` ou a quantidade de informações.'
      });
    }

    const channel = await interaction.guild.channels.fetch(RESULT_DRAFT_CHANNEL_ID);
    if (!channel?.isTextBased() || typeof channel.send !== 'function') {
      return interaction.editReply({
        content: `❌ O canal de rascunhos <#${RESULT_DRAFT_CHANNEL_ID}> não está disponível para mensagens.`
      });
    }

    await channel.send({
      content: messageContent,
      allowedMentions: { parse: [], users: officialIds }
    });

    return interaction.editReply({
      content: `✅ Rascunho de resultado publicado em <#${RESULT_DRAFT_CHANNEL_ID}>.`
    });
  }
};
