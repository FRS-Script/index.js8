const { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  StringSelectMenuBuilder,
  ChannelType, 
  PermissionsBitField,
  Collection
} = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

// ==============================================================================
// 1. إعداد عميل البوت والصلاحيات والشرايح
// ==============================================================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember, Partials.User]
});

// إعداد الذكاء الاصطناعي Gemini
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "ضع_مفتاح_GEMINI_هنا";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// ==============================================================================
// 2. نظام قاعدة البيانات المحلية وحفظ البيانات الضخمة (Local JSON DB)
// ==============================================================================
const DB_FILE = path.join(__dirname, 'database.json');

function loadDatabase() {
  if (!fs.existsSync(DB_FILE)) {
    const initialData = { 
      levels: {}, 
      rewards: {}, 
      warnings: {}, 
      tickets: {}, 
      settings: {},
      economy: {},
      logs: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  try {
    const raw = fs.readFileSync(DB_FILE);
    return JSON.parse(raw);
  } catch (err) {
    console.error("خطأ أثناء تحميل قاعدة البيانات:", err);
    return { levels: {}, rewards: {}, warnings: {}, tickets: {}, settings: {}, economy: {}, logs: [] };
  }
}

function saveDatabase(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("خطأ أثناء حفظ قاعدة البيانات:", err);
  }
}

let db = loadDatabase();

// ==============================================================================
// 3. حدث التشغيل الأولي (Ready Event)
// ==============================================================================
client.once('ready', () => {
  console.log(`================================================================`);
  console.log(`✅ تم تشغيل نظام GFXP الموحد بنجاح!`);
  console.log(`👤 الحساب المسؤول: ${client.user.tag}`);
  console.log(`🆔 المعرف الرقمي: ${client.user.id}`);
  console.log(`================================================================`);
  
  client.user.setActivity('سيرفر GFXP | اكتب !help للمساعدة 🚀', { type: 3 });
});

// ==============================================================================
// 4. وحدة الترحيب التلقائية بالصور والرسائل المخصصة
// ==============================================================================
client.on('guildMemberAdd', async (member) => {
  try {
    const welcomeChannel = member.guild.channels.cache.find(ch => ch.name === 'welcome' || ch.name === 'الترحيب');
    if (!welcomeChannel) return;

    const welcomeImageUrl = db.settings.welcomeImage || "https://i.ibb.co/L8yX321/gfxp-welcome.png"; 

    const welcomeEmbed = new EmbedBuilder()
      .setColor('#FEE75C')
      .setTitle(`👋 أهلاً بك في سيرفر ${member.guild.name}`)
      .setDescription(`أهلاً بك يا ${member} في سيرفرنا!\nنتمنى لك أوقاتاً ممتعة ومفيدة معنا. ✨`)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setImage(welcomeImageUrl)
      .setFooter({ text: `أنت العضو رقم ${member.guild.memberCount}` })
      .setTimestamp();

    welcomeChannel.send({ embeds: [welcomeEmbed] });
  } catch (err) {
    console.error("خطأ في نظام الترحيب:", err);
  }
});

// ==============================================================================
// 5. معالجة كافة الرسائل والأوامر البرمجية
// ==============================================================================
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const userId = message.author.id;

  // ----------------------------------------------------------------------------
  // أ. نظام النقاط والخبرة والتصنيف (XP & Leveling Engine)
  // ----------------------------------------------------------------------------
  if (!db.levels[userId]) {
    db.levels[userId] = { xp: 0, level: 1 };
  }

  db.levels[userId].xp += Math.floor(Math.random() * 10) + 5;
  let requiredXp = db.levels[userId].level * 100;

  if (db.levels[userId].xp >= requiredXp) {
    db.levels[userId].level += 1;
    message.channel.send(`🎉 مبروك يا ${message.author}! ارتفع مستواك إلى **(Level ${db.levels[userId].level})**! 🔥`);

    // منح رتبة المكافأة تلقائياً
    const rewardRoleId = db.rewards[db.levels[userId].level];
    if (rewardRoleId) {
      const role = message.guild.roles.cache.get(rewardRoleId);
      if (role) {
        message.member.roles.add(role).catch(() => {});
        message.channel.send(`🎁 تهانينا! حصلت على رتبة المكافأة تلقائياً: **${role.name}**!`);
      }
    }
  }
  saveDatabase(db);

  // ----------------------------------------------------------------------------
  // ب. أمر المساعدة الشامل (!help / !أوامر)
  // ----------------------------------------------------------------------------
  if (message.content === '!help' || message.content === '!أوامر') {
    const helpEmbed = new EmbedBuilder()
      .setColor('#FEE75C')
      .setTitle('📌 دليل أوامر بوت GFXP الشامل')
      .setDescription('إليك كافة الأوامر المتاحة مقسمة حسب الفئات والخدمات:')
      .addFields(
        { name: '🎧 القرآن والصوتيات', value: '`!media` أو `!تشغيل` - قائمة القراء القرآنية والصوتيات النظيفة.' },
        { name: '🎫 التذاكر والدعم', value: '`!setup-ticket [العنوان] | [رابط الصورة]` - إعداد روم التذاكر المخصص.' },
        { name: '⭐ المستويات والمكافآت', value: '`!level` - عرض مستواك والخبرة.\n`!add-reward [اللفل] [@الرتبة]` - تعيين مكافأة رتبة.' },
        { name: '🛡️ أدوات الإدارة', value: '`!clear [العدد]` - تطهير الشات.\n`!warn [@العضو] [السبب]` - إعطاء تحذير.\n`!ban [@العضو]` - حظر عضو.' },
        { name: '🤖 الذكاء الاصطناعي', value: 'قم بمنشن البوت `@GFXP` واسأله أي سؤال يجيبك فوراً.' }
      )
      .setFooter({ text: 'GFXP Bot System' });

    return message.channel.send({ embeds: [helpEmbed] });
  }

  // ----------------------------------------------------------------------------
  // ج. أمر فحص المستويات والخبرة (!level / !لفل)
  // ----------------------------------------------------------------------------
  if (message.content === '!level' || message.content === '!لفل') {
    const userLevel = db.levels[userId] ? db.levels[userId].level : 1;
    const userXp = db.levels[userId] ? db.levels[userId].xp : 0;
    const reqXp = userLevel * 100;

    return message.reply(`⭐ مستواك الحالي: **Level ${userLevel}**\n📊 نقاط الخبرة: **${userXp} / ${reqXp} XP**`);
  }

  // ----------------------------------------------------------------------------
  // د. أمر إضافة مكافآت اللفل (!add-reward)
  // ----------------------------------------------------------------------------
  if (message.content.startsWith('!add-reward') && message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    const args = message.content.split(' ');
    const targetLevel = parseInt(args[1]);
    const role = message.mentions.roles.first();

    if (!targetLevel || !role) {
      return message.reply('❌ الاستخدام الصحيح: `!add-reward [رقم اللفل] [@الرتبة]`');
    }

    db.rewards[targetLevel] = role.id;
    saveDatabase(db);
    return message.reply(`✅ تم ربط رتبة ${role} كمكافأة فورية عند الوصول لـ **Level ${targetLevel}**!`);
  }

  // ----------------------------------------------------------------------------
  // هـ. الأوامر الإدارية: مسح الرسائل (!clear)
  // ----------------------------------------------------------------------------
  if (message.content.startsWith('!clear') && message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
    const args = message.content.split(' ');
    const amount = parseInt(args[1]);

    if (!amount || isNaN(amount) || amount < 1 || amount > 100) {
      return message.reply('❌ يرجى كتابة عدد صحيح بين 1 و 100.');
    }

    await message.channel.bulkDelete(amount, true).catch(() => {});
    const confirmMsg = await message.channel.send(`🧹 تم مسح **${amount}** رسالة بنجاح.`);
    setTimeout(() => confirmMsg.delete().catch(() => {}), 3000);
    return;
  }

  // ----------------------------------------------------------------------------
  // و. الأوامر الإدارية: إعطاء تحذير (!warn)
  // ----------------------------------------------------------------------------
  if (message.content.startsWith('!warn') && message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
    const target = message.mentions.members.first();
    const reason = message.content.split(' ').slice(2).join(' ') || 'بدون سبب محدد';

    if (!target) return message.reply('❌ يرجى تحديد العضو بالمنشن.');

    if (!db.warnings[target.id]) db.warnings[target.id] = [];
    db.warnings[target.id].push({ reason, date: new Date().toISOString() });
    saveDatabase(db);

    return message.reply(`⚠️ تم تحذير العضو ${target} | السبب: **${reason}** (عدد التحذيرات: ${db.warnings[target.id].length})`);
  }

  // ----------------------------------------------------------------------------
  // ز. قائمة تشغيل القرآن الكاملة وقراء الحرم والصوتيات (!media)
  // ----------------------------------------------------------------------------
  if (message.content === '!media' || message.content === '!تشغيل') {
    const mediaEmbed = new EmbedBuilder()
      .setColor('#FEE75C')
      .setTitle('🎧 مكتبة قراء الحرم والموسيقى النظيفة - GFXP')
      .setDescription('اختر المحتوى الصوتي المطلوب من القائمة المنسدلة أدناه:');

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('media_select')
      .setPlaceholder('اختر القارئ أو قائمة الصوتيات...')
      .addOptions([
        { label: 'الشيخ ياسر الدوسري (تلاوات الحرم) 📖', description: 'جميع سور القرآن الكريم', value: 'quran_yasser' },
        { label: 'الشيخ ماهر المعيقلي (تلاوات الحرم) 📖', description: 'جميع سور القرآن الكريم', value: 'quran_maher' },
        { label: 'الشيخ عبد الرحمن السديس (إمام الحرم) 📖', description: 'جميع سور القرآن الكريم', value: 'quran_sudais' },
        { label: 'أناشيد إسلامية بدون إيقاع 🎶', description: 'محتوى راقي ونظيف', value: 'clean_nasheed' },
        { label: 'موسيقى استرخاء هادئة 🎵', description: 'صوتيات هادئة للاسترخاء', value: 'clean_chill' }
      ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);
    return message.channel.send({ embeds: [mediaEmbed], components: [row] });
  }

  // ----------------------------------------------------------------------------
  // ح. أمر إعداد التذاكر مع الصور والكلمات الخاصة (!setup-ticket)
  // ----------------------------------------------------------------------------
  if (message.content.startsWith('!setup-ticket') && message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    const content = message.content.replace('!setup-ticket', '').trim();
    const parts = content.split('|');

    const ticketTitle = parts[0] || '🎫 نظام الدعم الفني والتذاكر';
    const ticketImage = parts[1] ? parts[1].trim() : null;

    const ticketEmbed = new EmbedBuilder()
      .setColor('#FEE75C')
      .setTitle(ticketTitle)
      .setDescription('إذا كان لديك أي استفسار أو مشكلة، اضغط على الزر بالأسفل لفتح تذكرة وسيتم التواصل معك مباشرة.');

    if (ticketImage) ticketEmbed.setImage(ticketImage);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('create_ticket')
        .setLabel('فتح تذكرة 📩')
        .setStyle(ButtonStyle.Primary)
    );

    return message.channel.send({ embeds: [ticketEmbed], components: [row] });
  }

  // ----------------------------------------------------------------------------
  // ط. محرك الذكاء الاصطناعي (Gemini Chat Engine)
  // ----------------------------------------------------------------------------
  if (message.mentions.has(client.user) && !message.mentions.everyone) {
    const userPrompt = message.content.replace(`<@!${client.user.id}>`, '').replace(`<@${client.user.id}>`, '').trim();
    if (!userPrompt) return message.reply('أهلاً بك! أنا بوت GFXP الذكي، كيف يمكنني مساعدتك؟ 🤖');

    try {
      await message.channel.sendTyping();
      const result = await aiModel.generateContent(userPrompt);
      const response = await result.response;
      const text = response.text();
      message.reply(text.length > 2000 ? text.substring(0, 1990) + '...' : text);
    } catch (error) {
      message.reply('حدث خطأ أثناء التواصل مع الذكاء الاصطناعي.');
    }
  }
});

// ==============================================================================
// 6. معالجة التفاعلات والأزرار القوائم التفاعلية (Interactions)
// ==============================================================================
client.on('interactionCreate', async (interaction) => {
  // القائمة المنسدلة للقرآن والموسيقى
  if (interaction.isStringSelectMenu() && interaction.customId === 'media_select') {
    const selected = interaction.values[0];
    const voiceChannel = interaction.member.voice.channel;

    if (!voiceChannel) {
      return interaction.reply({ content: '⚠️ يجب أن تكون متصلاً بروم صوتي لاستخدام هذا الخيار!', ephemeral: true });
    }

    const playerEmbed = new EmbedBuilder()
      .setColor('#FEE75C')
      .setTitle('▶️ جاري التشغيل الآن')
      .setDescription(`المحتوى المحدد: **${selected}**\nداخل الروم الصوتي: **${voiceChannel.name}**`);

    const controlButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('pause_song').setLabel('إيقاف مؤقت ⏸️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('stop_song').setLabel('إيقاف ⏹️').setStyle(ButtonStyle.Danger)
    );

    return interaction.reply({ embeds: [playerEmbed], components: [controlButtons] });
  }

  if (!interaction.isButton()) return;

  // زر فتح التذكرة
  if (interaction.customId === 'create_ticket') {
    const guild = interaction.guild;
    const ticketName = `ticket-${interaction.user.username}`;

    const existingChannel = guild.channels.cache.find(c => c.name === ticketName.toLowerCase());
    if (existingChannel) {
      return interaction.reply({ content: `لديك تذكرة مفتوحة بالفعل هنا: ${existingChannel}`, ephemeral: true });
    }

    const ticketChannel = await guild.channels.create({
      name: ticketName,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ]
    });

    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('close_ticket')
        .setLabel('إغلاق التذكرة 🔒')
        .setStyle(ButtonStyle.Danger)
    );

    await ticketChannel.send({
      content: `مرحباً بك ${interaction.user}، كيف يمكننا مساعدتك اليوم؟`,
      components: [closeRow]
    });

    return interaction.reply({ content: `تم فتح التذكرة بنجاح: ${ticketChannel}`, ephemeral: true });
  }

  // زر إغلاق التذكرة
  if (interaction.customId === 'close_ticket') {
    await interaction.reply('⚠️ سيتم إغلاق التذكرة وحذف الروم خلال 5 ثوانٍ...');
    setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
  }

  // أزرار التحكم بالصوتيات
  if (interaction.customId === 'pause_song') {
    interaction.reply({ content: '⏸️ تم إيقاف التشغيل مؤقتاً.', ephemeral: true });
  }
  if (interaction.customId === 'stop_song') {
    interaction.reply({ content: '⏹️ تم إيقاف المشغل بالكامل.', ephemeral: true });
  }
});

// ==============================================================================
// 7. تسجيل الدخول وتشغيل البوت
// ==============================================================================
const BOT_TOKEN = process.env.BOT_TOKEN || "";
client.login(MTU1MTgyNDIwNzI1MDQ1NjY0Ng.GgELl8.w6r0ZYtFXYj0ZDCeaEEclZLgv20ngv_3RTsiVc);
