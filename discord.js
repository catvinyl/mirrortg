const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, WebhookClient } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

var frozenUserIds = [];

function getOptionInteraction(interaction, type, id) {
  switch (type.toLowerCase()) {
    case 'string':
      return interaction.options.getString(id);
    case 'integer':
      return interaction.options.getInteger(id);
    case 'boolean':
      return interaction.options.getBoolean(id);
    case 'user':
      return interaction.options.getUser(id);
    case 'member':
      return interaction.options.getMember(id);
    case 'channel':
      return interaction.options.getChannel(id);
    case 'role':
      return interaction.options.getRole(id);
    case 'mentionable':
      return interaction.options.getMentionable(id);
    case 'number':
      return interaction.options.getNumber(id);
    case 'attachment':
      return interaction.options.getAttachment(id);
    default:
      throw new Error(`Unknown type: ${type}`);
  }
}

var commands = [];
function createMediaDEmbeds(mediaUrls) {
  if (mediaUrls.length == 0) {
    return [];
  }
  return mediaUrls.map((url, index) => {
    const embed = new EmbedBuilder()
      .setTitle(`Media #${index + 1}`)
      .setImage(url);
    return embed;
  });
}

function tgcToD(webhookParameters, msg, remove) {
  const webhookClient = new WebhookClient(webhookParameters);
  var content = msg.text;
  // if(msg.mediaUrls.length > 0){
  //     content += ' ' + msg.mediaUrls.join(' ');
  // }

  var description = '👀' + msg.views + ' ';
  if (msg.is_edited) {
    description += '📝✔️ ';
  }
  if (msg.haveVideo) {
    description += '🎥✔️ ';
  }
  if (msg.haveFile) {
    description += '📄✔️ ';
  }
  description += '⌛️' + msg.time;
  const embed = new EmbedBuilder()
    .setColor(0x0099FF);

  if (msg.forwardedFrom) {
    embed.setTitle('FWD: ' + msg.forwardedFrom.tgc_channel_name);
    embed.setURL(msg.forwardedFrom.msg_url);
  } else {
    embed.setTitle(msg.msg_url);
    embed.setURL(msg.msg_url);
  }

  embed.setDescription(description);
  var avatarURL = msg.tgc_picture;
  if(avatarURL.startsWith('data')){
    avatarURL = 'https://telegram-rip.pages.dev/tombstone.png';
  }
  webhookClient.send({
    content: content,
    username: msg.tgc_channel_name,
    avatarURL: avatarURL,
    embeds: [...createMediaDEmbeds(msg.mediaUrls), embed],
  }).catch(function (error) {
    if(error.status == 404){
      return remove();
    }
    console.log(error);
  });
  delete webhookClient;
}

var slash_commands_array = [];

function buildSlashCommandArray() {
  for (let i = 0; i < commands.length; i++) {
    const command = commands[i];
    const slash_command = new SlashCommandBuilder()
    .setName(command.name)
    .setDescription(command.description);
    if(command.options){
      const options = command.options;
      for (let x = 0; x < options.length; x++) {
        const option = options[x];
        const type = option.type.toLowerCase();
        if(type == 'string'){
          slash_command.addStringOption(o =>
            o.setName(option.name || 'untitled_option_' + x)
              .setDescription(option.description || 'No description')
              .setRequired(option.required));
        }
      }
    }
    slash_commands_array.push(slash_command);
  }
}

async function deploySlashCommandsArray(){
  for (let i = 0; i < slash_commands_array.length; i++) {
    const slash_command = slash_commands_array[i];
    await client.application.commands.create(slash_command);
  }
}

client.on("ready", async () => {
  console.log(`${client.user.tag} is ready!`);
  client.user.setActivity('working');
  buildSlashCommandArray();
  await deploySlashCommandsArray()
});

client.on('interactionCreate', (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if(interaction.commandName != 'unfreeze'){
    if(frozenUserIds.indexOf(interaction.user.id) != -1){
      return;
    }
  }
  var options = {};
  for (let i = 0; i < commands.length; i++) {
    const command = commands[i];
    if(command.name == interaction.commandName){
      if(command.function){
        if(command.options){
          for (let x = 0; x < command.options.length; x++) {
            const o = command.options[x];
            options[o.name] = getOptionInteraction(interaction, o.type, o.name);
          }
        }
        command.function(interaction, options);
      }
    }
  }
});

exports.login = function (token){
    client.login(token);
}
exports.tgcToD = tgcToD;
exports.loadCmds = async function (cmds) {
  commands = cmds;;
};
exports.updateFrozenUsers = function (arr) {
  frozenUserIds = arr;
}