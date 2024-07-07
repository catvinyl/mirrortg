const DiscordJS = require('discord.js');
const tg = require('./tg.js');
const crypto = require('crypto');
const discord = require('./discord.js');
const dbjs = require('./db.js');

var uptimeProgram = 0; // new variable to keep track of program uptime

var password = 'testpassword';

function updateUptime() {
  uptimeProgram++; // increment program uptime
  db.uptime++;
}

function sanitizeTGCInput(url) {
  const urlParts = url.split('/');
  for (let i = urlParts.length - 1; i >= 0; i--) {
    const part = urlParts[i];
    if (part && part !== '' && !part.includes('?') && !part.includes('.')) {
      return part;
    }
  }
  return '';
}

function secondsToObject(s) {
  return {
    d: Math.floor(s / 60 / 60 / 24),
    h: Math.floor((s % (60 * 60 * 24)) / (60 * 60)),
    m: Math.floor((s % (60 * 60)) / 60),
    s: s % 60
  };
}

function generateUptimeText() {
  const dbUptime = secondsToObject(db.uptime);
  const u = secondsToObject(uptimeProgram);

  if (Number.isNaN(db.startDate)) {
    db.startDate = new Date();
  }

  var totalSeconds = (new Date() - new Date(db.startDate)) / 1000;
  var uptimePercentage = (db.uptime / totalSeconds) * 100;

  return `total uptime: ${dbUptime.d}d ${dbUptime.h}h ${dbUptime.m}m ${dbUptime.s}s / uptime from start: ${u.d}d ${u.h}h ${u.m}m ${u.s}s / uptime percentage: ${uptimePercentage.toFixed(2)}%`;
}

async function moveDChannelToCategory(categoryName, channel) {
  const guild = channel.guild;
  const category = guild.channels.cache.find(c => c instanceof DiscordJS.CategoryChannel && c.name.toLowerCase() === categoryName.toLowerCase());
  if (!category) {
    return;
  }
  try {
    await channel.setParent(category);
  } catch (error) {
    
  }
}

var commands = [{
  name: 'addtelegramc',
  description: 'Add Telegram channel as channel',
  function: function (interaction, options) {
    const isAdministrator = interaction.member.permissions.has('ADMINISTRATOR');
    if (!isAdministrator) {
      return interaction.reply({ content: 'This only for administrators!', ephemeral: true });
    }
    // Create a new channel
    const guild = interaction.member.guild;
    const tgcid = sanitizeTGCInput(options.tgcid);
    var reg = findIdInRegister(tgcid);
    if (!reg) {
      reg = {
        id: tgcid, update_checksum: "", listeners: []
      };
      db.register.push(reg);
    }
    guild.channels.create({
      name: tgcid,
      type: DiscordJS.ChannelType.GuildText, // Create a text channel
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: [DiscordJS.PermissionFlagsBits.SendMessages],
          allow: [DiscordJS.PermissionFlagsBits.AddReactions, DiscordJS.PermissionFlagsBits.ViewChannel, DiscordJS.PermissionFlagsBits.ReadMessageHistory]
        },
      ],
    })
      .then(channel => {
        // Create a new webhook in the channel
        moveDChannelToCategory('mirrortg', channel);
        guild.channels.createWebhook({
          channel: channel.id,
          name: 'mirrortg-' + tgcid,
          avatar: 'https://telegram-rip.pages.dev/tombstone.png',
          reason: 'mirrrortg beautyful webhook'
        })
          .then(function (webhook) {
            reg.listeners.push(webhookURL(webhook.url));
            interaction.reply({ content: 'Succefully created! tgcid: ' + tgcid });
          })
          .catch(function () {
            interaction.reply({ content: 'Error creating webhook!', ephemeral: true });
          });
      })
      .catch(function () {
        interaction.reply({ content: 'Error creating channel!', ephemeral: true });
      });
  },
  options: [{ name: 'tgcid', description: 'Telegram channel id or url', required: true, type: 'string' }]
},
{
  name: 'get',
  description: 'Get last message from Telegram channel (provide id)',
  function: async function (interaction, options) {
    const tgcid = sanitizeTGCInput(options.tgcid);
    const tgc_msgs = await tg.getTGCMessages(tgcid);
    const tgc_last_msg = tgc_msgs[tgc_msgs.length - 1];
    interaction.reply(tgc_last_msg.text);
  },
  options: [{ name: 'tgcid', description: 'Telegram channel id or url', required: true, type: 'string' }]
},
{
  name: 'uptime',
  description: 'Get uptime',
  function: function (interaction) {
    interaction.reply(generateUptimeText());
  },
},
{
  name: 'freeze',
  description: 'I can not hear! (for testing)',
  function: function (interaction) {
    db.frozenUserIds.push(interaction.user.id);
    discord.updateFrozenUsers(db.frozenUserIds);
    interaction.reply({ content: 'sad. hope you improve me.', ephemeral: true });
  },
},
{
  name: 'unfreeze',
  description: 'Allow me to response!',
  function: function (interaction) {
    const i = db.frozenUserIds.indexOf(interaction.user.id);
    if (i !== -1) {
      db.frozenUserIds.splice(i, 1);
    }
    discord.updateFrozenUsers(db.frozenUserIds);
    interaction.reply({ content: 'yay!', ephemeral: true });
  },
}];

var db = {
};

function findIdInRegister(id) {
  for (let i = 0; i < db.register.length; i++) {
    if (db.register[i].id === id) {
      return db.register[i];
    }
  }
  return null; // or throw an error if not found
}

function webhookURL(url) {
  const regex = /^https:\/\/discord\.com\/api\/webhooks\/([^\/]+)\/([^\/]+)$/;
  const match = url.match(regex);
  if (match) {
    return {
      id: match[1],
      token: match[2]
    };
  } else {
    throw new Error(`Invalid URL format: ${url}`);
  }
}

function generateChecksum(string) {
  if (typeof string == 'object') {
    string = JSON.stringify(string);
  }
  const hash = crypto.createHash('sha256');
  hash.update(string);
  return hash.digest('hex');
}

async function checkRegister() {
  for (let i = 0; i < db.register.length; i++) {
    const e = db.register[i];
    const tgc_msgs = await tg.getTGCMessages(e.id);
    const tgc_last_msg = tgc_msgs[tgc_msgs.length - 1];
    const checksum = generateChecksum(tgc_last_msg.time + tgc_last_msg.text);
    if (checksum != e.update_checksum) {
      e.update_checksum = checksum;
      for (let x = 0; x < e.listeners.length; x++) {
        const listener = e.listeners[x];
        discord.tgcToD(listener, tgc_last_msg, function(){
          e.listeners.splice(i, 1);
          console.log(e.listeners);
        });
      }
    }
  }
}

function everyminute() {
  checkRegister();
  dbjs.saveDB(password, db, 'db.bin');
}
async function main() {
  if (process.env.PASSWORD) {
    password = process.env.PASSWORD;
  }
  if (process.env.TOKEN) {
    db.token = process.env.TOKEN;
  }
  var dbtmp = await dbjs.loadDBFromFile(password, 'db.bin');
  if (dbtmp) {
    db = dbtmp;
  }
  if (!db.register) {
    db.register = [];
  }
  if (!db.startDate) {
    db.startDate = new Date();
  }
  if (!db.uptime) {
    db.uptime = 0;
  }
  if(!db.frozenUserIds){
    db.frozenUserIds = [];
  }
  setInterval(updateUptime, 1000);
  discord.loadCmds(commands);
  if(db.token){
    discord.login(db.token);
  }else{
    console.log('Error: No token!');
  }
  setInterval(everyminute, 6 * 1000);
}
main();
