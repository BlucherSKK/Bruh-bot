import { fileURLToPath } from 'url';
import path from 'path';
import {
    Client,
    GatewayIntentBits,
    GuildMember,
    Message,
    TextChannel,
    REST,
    Routes,
    SlashCommandBuilder,
    Events,
    ChatInputCommandInteraction,
} from 'discord.js';
import makeWelcome from './Pandora/makeWelcome.tsx';
import * as fs from 'fs';
import cron from 'node-cron';
import parser from 'cron-parser';
import * as ini from "ini";
// fs уже импортирован выше
import { BruhFn } from './Pandora/Pandora.ts';
import { files_io } from './Pandora/parsing.ts';
import { get_moder } from './Pandora/note.ts';
import { message_command_handler } from "./Pandora/adminHandler.ts";
import { autoPostScheduler, setSchedulePost } from './Pandora/autopost.ts';
import { startStaffSearch } from './Pandora/StaffSearch.ts';
import { setGlobalDispatcher, Agent } from 'undici';

setGlobalDispatcher(new Agent({
    connect: {
        timeout: 60000,
        // Отключаем ALPN h2, чтобы форсировать HTTP/1.1
        // Это критично для работы через Tun-интерфейсы и прокси
        allowH2: false
    },
    // Увеличиваем время жизни сокета
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10,
    pipelining: 0 // Отключаем конвейеризацию для исключения разрывов
}));
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.AutoModerationConfiguration,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
    rest: {
        timeout: 300000, // Увеличиваем до 5 минут
        retries: 10,     // Больше попыток при сбое
    },
});

// --- ЗАГРУЗКА КОНФИГА ---
const CONFIG_INI_PATH  = process.env.BOT_CONFIG_FILE  ?? '##CONFIGFILE##';
const TOKEN_JSON_PATH  = process.env.BOT_TOKEN_FILE   ?? '##TOKENJSON##';

const { TOKEN } = JSON.parse(fs.readFileSync(TOKEN_JSON_PATH, 'utf-8')) as { TOKEN: string };
const MAIN_CONFIG_CONTENT = fs.readFileSync(CONFIG_INI_PATH, 'utf-8');
const BRUH_ID = files_io.ini_get_config_value(MAIN_CONFIG_CONTENT, "bruh info", "ID")[0];
const GUILD_ID = files_io.ini_get_config_value(MAIN_CONFIG_CONTENT, "bruh info", "SERVER")[0];
export const START_TIME = Date.now();
export const ADMIN_CHANNEL_ID = files_io.ini_get_config_value(MAIN_CONFIG_CONTENT, "Channels", "Admin")[0];

const CONTENT_CHANLES_IDS = files_io.ini_get_config_value(MAIN_CONFIG_CONTENT, "Channels", "Saveable");
const ACCSEPT_CHANNLES_IDS = files_io.ini_get_config_value(MAIN_CONFIG_CONTENT, "Channels", "ACCSEPT_CHANNLES");
const HENTAI_DIR = "./hentaiStaff";
const HOST = files_io.ini_get_config_value(MAIN_CONFIG_CONTENT, "bruh info", "HOST")[0];
const rest = new REST({ version: '10' }).setToken(TOKEN);
const WELKOM_ID = files_io.ini_get_config_value(MAIN_CONFIG_CONTENT, "Channels", "WELKOM")[0];
const ANIME_LIST = "assets/anime.txt";
const LOGS = "./bruh.log";
let nextRunTimer: any = null;
let last_pivo_msg: any;



export enum OptionsTypes {
    STRING = 3,
    INTEGER,
    BOOLEAN,
    USER,
    CHANNEL,
    ROLE,
    MENTIONABLE,
}

const COMMANDS = [
{ name: 'info', description: 'информация о боте' },
{ name: "anime_list", description: "показывает список из которого рандомайзится аниме" },
{
    name: 'add_anime_to_bank',
    description: "добовляет аниме в список для рандомайзинга",
    options: [{ name: "anime", description: "можно несколько через ;", type: OptionsTypes.STRING, required: true }]
},
{ name: "random_anime", description: "бот выберет рандомное аниме из файла на сервере" },
{ name: "when_friday", description: "..." },
];

// Регистрация команд
BruhFn.regist_commands(COMMANDS, rest, BRUH_ID, GUILD_ID);

// --- ОБРАБОТЧИКИ СОБЫТИЙ ---

client.on(Events.ClientReady, async () => {
    BruhFn.setFrideyScheduler(
        client,
        '1251045085085175909',
        'А вот и пятница мои shikikanы!',
        './assets/za_pivom.gif',
        "0 0 10 * * 5",
        last_pivo_msg,
    );

    startStaffSearch(client);

    if (client.user) {
        console.log(`Бот - ${client.user.tag} запущен! сборка: ##BUILDTIME##`);
    };
});

client.rest.on('rateLimited', (rateLimitInfo) => {
    console.log(`[REST] Rate Limit: ${rateLimitInfo.sublimitTimeout}ms | Limit: ${rateLimitInfo.limit}`);
});

client.once(Events.ClientReady, async () => {
    autoPostScheduler(client);
});

// Обработка ошибок сети, чтобы бот не падал
client.on(Events.ShardError, error => {
    console.error('[PANDORA] Ошибка соединения (WebSocket):', error);
});

client.on(Events.MessageCreate, (message) => {
    message_command_handler(message, LOGS, ANIME_LIST, HOST, client, CONTENT_CHANLES_IDS,
                            HENTAI_DIR, ACCSEPT_CHANNLES_IDS,
                            ADMIN_CHANNEL_ID, GUILD_ID, WELKOM_ID, BRUH_ID
    );
});

client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
    BruhFn.MemberHandler.NewMember(member, WELKOM_ID);
});

client.on(Events.GuildMemberRemove, async (member: GuildMember | PartialGuildMember) => {
    BruhFn.MemberHandler.LeaveMember(member, ADMIN_CHANNEL_ID);
});

client.on(Events.InteractionCreate, async (interaction) => {
    if(interaction.isCommand()) {
        const cmd = interaction as ChatInputCommandInteraction;
        BruhFn.interect.Info(cmd);
        BruhFn.interect.getTimeUntilFriday(cmd);
        BruhFn.interect.random_anime_from_txt(cmd, ANIME_LIST);
        BruhFn.interect.add_anime(cmd, ANIME_LIST);
        BruhFn.interect.show_anime_list(cmd, ANIME_LIST);
    }
});

// Запуск
client.login(TOKEN);
