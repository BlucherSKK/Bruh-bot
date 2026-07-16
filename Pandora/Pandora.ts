/*
 ________  ________  ________   ________  ________  ________  ________     
|\   __  \|\   __  \|\   ___  \|\   ___ \|\   __  \|\   __  \|\   __  \    
\ \  \|\  \ \  \|\  \ \  \\ \  \ \  \_|\ \ \  \|\  \ \  \|\  \ \  \|\  \   
 \ \   ____\ \   __  \ \  \\ \  \ \  \ \\ \ \  \\\  \ \   _  _\ \   __  \  
  \ \  \___|\ \  \ \  \ \  \\ \  \ \  \_\\ \ \  \\\  \ \  \\  \\ \  \ \  \ 
   \ \__\    \ \__\ \__\ \__\\ \__\ \_______\ \_______\ \__\\ _\\ \__\ \__\
    \|__|     \|__|\|__|\|__| \|__|\|_______|\|_______|\|__|\|__|\|__|\|__|

    author - Blüchеr

    Пандора - простая библиотека на тайп скрипт для создания дискорд ботов для 
    управления фото и видео контентом на серверах, пандора позволяет удобно управлять 
    контентом создоваемым участниками сервера. Библиотека реализует сортировку, 
    хранение и передачу(можно просто насроить отправку архивоф с артами себе в лс к приммеру по пятницам) 
    контента с дискорд серверов.
*/
import { spawn } from 'node:child_process';
import { 
    Client, 
    Role, 
    TextChannel, 
    Message, 
    Collection, 
    EmbedBuilder, 
    DMChannel, 
    NewsChannel, 
    AttachmentBuilder, 
    GuildMember, 
    PermissionsBitField, 
    ChannelType, 
    MessagePayload, 
    Routes, 
    GuildChannel,
    Attachment,
    PermissionFlagsBits,
    Guild,
    CategoryChannel} from 'discord.js';
import type { 
    Channel, 
    PartialGuildMember, 
    GuildBasedChannel, 
    REST, 
    ChatInputCommandInteraction, 
    InteractionReplyOptions, 
    InteractionResponse, 
    MessageCreateOptions, 
    User} from 'discord.js';
import fetch from 'node-fetch';
import fs from 'fs';
import path, { resolve } from 'path';
import archiver from 'archiver';
import cron from 'node-cron';
import parser, { CronDate, CronExpression } from 'cron-parser';
import { pathToFileURL } from 'url';
import { BR_set_file_downloadeable } from './HttpGiver';
import exp from 'constants';
import makeWelcome from './makeWelcome';
import { channel } from 'diagnostics_channel';
import https from 'https';
import { error } from 'console';
import { AltApi, files_io } from './parsing';
import * as Note from "./note";
import * as adminHandler from './adminHandler';
import { BOT_DIR } from './constants';
import { START_TIME } from '../main';
export const ADMIN_CALLABLE_ID = '657872729126469642';

/*
@BruhFn - основной наймспайс для этой либы 
*/
export namespace BruhFn{

    export async function getChannelNameById(client: Client, channelIds: string[]): Promise<string[]> {
        let ChannelsName: string [] = [];
        for(const channelId of channelIds){
            try {
            // 1. Пытаемся взять из кэша (быстрее)
            let channel = client.channels.cache.get(channelId);

            if (!channel) {
                channel = await client.channels.fetch(channelId) ?? undefined;
            }

            if (channel && 'name' in channel) {
                ChannelsName.push(channel.name || "unuknown");
                break;
            }

            // Если это DM канал, можно вернуть имя собеседника или пометку
            if (channel?.type === ChannelType.DM) {
                ChannelsName.push("DM-Channel");
                break;
            }

            ChannelsName.push("unuknown");
        } catch (error) {
            console.error(`Ошибка при получении канала ${channelId}:`, error);
            ChannelsName.push("unuknown");
            break;
        }

        }
    }

    export function da_net(value: boolean): string{
        if(value){return "ДА"}else{return "НЕТ"}
    }

    export enum COLOR{
        NOTIFICATION = 0x07f,
        STD_REQUAST = 0x50ff50,
        AHTUNG = 0xff0000,
        ADMIN_REQ = 0xdaf527,
    }

    export async function setFrideyScheduler(
        client: Client, 
        channelId: string, 
        messageContent: string, 
        filePath: string,
        cronExpression: string,
        now: boolean = false,
        last_msg?: Message
    ) { 
        
        if(last_msg instanceof Message){
            try{
                await last_msg.delete();
            } catch (error) {
                low.logHandle(`Ошибка при удалении прошлого пятничного сообшения "${messageContent}": ${error}`)
            }
        }

        const schedule_body = async () => {
            let channel = client.channels.cache.get(channelId) as Channel
            if(channel instanceof TextChannel){
                last_msg = await channel.send({
                    content: messageContent,
                    files: [filePath],
                    });
                low.logHandle("Сообшение на пятницу отправлено");
                return;    
            }
            
        }

        if (now) {
            schedule_body();
            return;
        }

        cron.schedule(cronExpression,
            schedule_body,
            {
            timezone: 'Europe/Moscow'
        });
    }
    

    /**
     * 
     * @regist_commands - функция для регистрации слеш-коммандбота
     */
    export async function regist_commands(commands: {
        name: string,
        description: string,
    }[],
    rest: REST,
    cliendID: string,
    guidID: string
    ): Promise<void> {
        try {
            await rest.put(Routes.applicationGuildCommands(cliendID, guidID), {
                body: commands,
            });
    
            low.logHandle('Команды успешно обновлены!');
        } catch (error) {
            low.logHandle(error);
        }
    }


    /**
    @interect - наймспайс с функциями для обработки комманд бота
     */
    export namespace interect{

        interface AnimeImage {
            jpg: {
                large_image_url: string;
            };
        }

        interface Anime {
            mal_id: number;
            title: string;
            images: AnimeImage;
        }

        interface SearchResponse {
            data: Anime[];
        }

        export async function add_anime(interact: ChatInputCommandInteraction, filepath: string) {
            const { commandName, channel } = interact;

            if (commandName !== 'add_anime_to_bank') { return; }
            if (!(channel instanceof TextChannel)) { return; }

            //interact.reply("Подожди...");

            const titles = interact.options.getString("anime")?.split(";") as string[];
            let reply_embed = new EmbedBuilder().setTitle("Аниме добавлено:").setColor(COLOR.STD_REQUAST);
            let animes: string[] = []; // Инициализация массива fields

            for (const title of titles) {
                files_io.add_anime_to_file(filepath, title);
                animes.push(title); // Добавление поля с пустым значением
            }

            reply_embed.setDescription(animes.join('\n')); // Добавление всех полей в embed

            // Отправка embed в канал
            await interact.reply({embeds: [reply_embed]});
        }

        export async function show_anime_list(interact: ChatInputCommandInteraction, filePath: string) {
            const { commandName, channel } = interact;

            if (commandName !== "anime_list") { return; }
            if (!(channel instanceof TextChannel)) { return; }

            const animes = fs.readFileSync(filePath, 'utf-8');
            let emd;

            if (animes == ""){
                emd = {embeds: [ new EmbedBuilder()
                    .setTitle("Список аниме пуст!")
                    .setColor(COLOR.STD_REQUAST)
                ]};
            } else {
                emd = {embeds: [ new EmbedBuilder()
                    .setTitle("Список аниме:")
                    .setColor(COLOR.STD_REQUAST)
                    .setDescription(animes)
                ]};
            }

            interact.reply(emd);


        }

        export async function random_anime_from_txt(interact: ChatInputCommandInteraction, filepath: string) {
            const { commandName, channel } = interact;

            if (commandName !== "random_anime") { return; }
            if (!(channel instanceof TextChannel)) { return; }

            try {
                // Получаем канал и сообщение
                const f_q_lines = fs.readFileSync(filepath, 'utf-8').split('\n').length;


                if (f_q_lines > 1) {
                    const animeName = files_io.random_anime_und_move(filepath, Math.floor(Math.random() * (f_q_lines - 1))) as string;
                    const searchResponse = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(animeName)}&sfw`);
                    const searchData: SearchResponse = await searchResponse.json() as SearchResponse; // Указываем тип данных

                    if (searchData && searchData.data.length > 0) {
                        const animeId = searchData.data[0].mal_id; // Получаем ID первого результата
                        const bannerUrl = searchData.data[0].images.jpg.large_image_url; // Получаем URL баннера

                        console.log(`ID аниме: ${animeId}`);
                        console.log(`Баннер аниме: ${bannerUrl}`);
                        if(animeId && bannerUrl){
                            const reply_entity = new EmbedBuilder()
                                .setTitle('Думаю вам стоит посмотреть это')
                                .setDescription(animeName)
                                .setColor(0x009999)
                                .setImage(bannerUrl)

                            await interact.reply({ embeds: [reply_entity] });
                            await low.logHandle(`Запрос на рандомайзинг аниме из файла ${filepath} выполнен`);
                            return;
                        } else {
                            low.logHandle("Ошибка парсинга данных")
                        }
                    } else {
                        await interact.reply({ embeds: [new EmbedBuilder()
                                .setTitle('Думаю вам стоит посмотреть это')
                                .setDescription(animeName)
                                .setColor(0x009999)
                            ]
                        });
                    }
                } else {
                    await low.send_deletable_reply(interact, `В файле ${filepath} ничего нет.`);
                }
            } catch (error) {
                console.error(error);
                await low.send_deletable_reply(interact, `Ошибка: ${error as string}`);
            }
        }


        export async function getTimeUntilFriday(interect: ChatInputCommandInteraction) {
            const { commandName, member, channel } = interect;

            if(commandName != "when_friday"){return}

            const nowUTC = new Date(); // Текущее время по UTC
            const mskOffset = 3 * 60 * 60 * 1000; // Смещение для MSK (UTC+3)
            const nowMSK = new Date(nowUTC.getTime() + mskOffset); // Текущее время по MSK

            const daysUntilFriday = (5 - nowMSK.getUTCDay() + 7) % 7; // 5 = пятница
            const nextFriday = new Date(nowMSK.getTime() + daysUntilFriday * 24 * 60 * 60 * 1000);
            nextFriday.setHours(10, 0, 0, 0); // Устанавливаем 10:00 по MSK

            // Если сейчас пятница до 10:00, считать, что время до следующей пятницы
            if (daysUntilFriday === 0 && nowMSK.getHours() < 10) {
                nextFriday.setTime(nextFriday.getTime() + 7 * 24 * 60 * 60 * 1000); // Добавить 7 дней
            }

            const timeDifference = nextFriday.getTime() - nowMSK.getTime();
            const totalSeconds = Math.floor(timeDifference / 1000);
            const hours = Math.floor(totalSeconds / 3600); // 3600 секунд в часе
            const minutes = Math.floor((totalSeconds % 3600) / 60); // Остаток минут
            const seconds = totalSeconds % 60; // Остаток секунд

            if(channel instanceof TextChannel){
                low.send_deletable_reply(interect, `Скоро:
            ${hours} часов ${minutes} минут ${seconds} секунд`);
            };
        }

        function getUptimeString(): string {
            const diff = Date.now() - START_TIME;

            // Переводим миллисекунды в общие секунды
            const totalSeconds = Math.floor(diff / 1000);

            const days = Math.floor(totalSeconds / (24 * 3600));
            const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;

            const parts: string[] = [];

            if (days > 0) parts.push(`${days}d`);
            if (hours > 0) parts.push(`${hours}h`);
            if (minutes > 0) parts.push(`${minutes}m`);
            parts.push(`${seconds}s`);

            return parts.join(' ');
        }

        export async function Info(interect: ChatInputCommandInteraction) {
            const { commandName, member, channel } = interect;

            if(commandName != "info"){return}
            if(!(member instanceof GuildMember)){return}

            const version = '##VERSION##';
            const lastUpdate = '##VERSIONDATE##';

            // Получаем внешний IP и геолокацию
            let ipField = 'Недоступно';
            try {
                const ipRes = await fetch('https://ifconfig.me/ip');
                const ip = (await ipRes.text()).trim();

                let locationSuffix = '';
                try {
                    const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
                    const geo = await geoRes.json() as { country_code?: string; city?: string; country_name?: string };
                    if (geo.country_code && geo.city) {
                        // Превращаем код страны в эмодзи-флаг (каждая буква → региональный индикатор)
                        const flag = geo.country_code
                            .toUpperCase()
                            .split('')
                            .map((c: string) => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
                            .join('');
                        locationSuffix = ` (${flag} ${geo.city}, ${geo.country_name ?? geo.country_code})`;
                    }
                } catch (_) { /* геолокация недоступна */ }

                ipField = `\`${ip}\`${locationSuffix}`;
            } catch (_) { /* ifconfig.me недоступен */ }
        
            const embed = new EmbedBuilder()
                .setTitle('Информация о боте')
                .setColor(0x9834db)
                .setImage('https://cdn.discordapp.com/app-icons/1240895608454385695/1ff43e19cb1aae20d6bf5688839c6cbb.png?size=512')
                .addFields(
                    { name: 'Версия бота', value: version, inline: false },
                    { name: 'Дата последнего обновления', value: lastUpdate, inline: false },
                    { name: 'Время работы', value: getUptimeString(), inline: false },
                    { name: '🌐 IP-адрес', value: ipField, inline: false },
                )
            
            if (channel instanceof TextChannel) {
                await interect.reply({ embeds: [embed] });
            } else {
                low.logHandle("Канал не поддерживает отправку сообщений.");
            }
        }
    }

        


        /**
         * 
         * @OneTimeSaver - функция сохроняюшая в бота арты за определённый перюд по админской кооманде
         */
       
    
    

    /**
     * @MemderActionHandler - наймспайс с функциями для обработки других действий пользователей
     */
    export namespace MemberHandler{
        export async function NewMember(member: GuildMember, channelID: string) {
            const channel = member.guild.channels.cache.get(channelID);
            if (!(channel instanceof TextChannel)) {
                console.log('Модуль велкомГиф: Не нашёл канал!');
                return;
            }
        
            await low.addRole(member, '1239845097978204211', '1239995777858797639'); // Используем функцию для добавления роли
        
            await makeWelcome(member.displayName, member.user.displayAvatarURL({ size: 128, extension: 'png' }), 426, 240, BOT_DIR + `/tmp/${member.id}.png`);

            if (!fs.existsSync('./assets/background.gif')) {
                low.logHandle('Файл background.gif не найден!');
                return;
            }

        
            await new Promise((resolve, reject) => {
                const ffmpeg = spawn('ffmpeg', [
                    '-y',
                    '-i', './assets/background.gif',
                    '-i', BOT_DIR + `/tmp/${member.id}.png`,
                    '-filter_complex', 'overlay=0:0',
                    BOT_DIR + `/tmp/${member.id}.gif`,
                ]);

                ffmpeg.on('close', (code) => {
                    if (code === 0) {
                        resolve(true);
                    } else {
                        console.error(`FFMPEG завершился с ошибкой, код: ${code}`);
                        reject(new Error(`FFMPEG failed with code ${code}`));
                    }
                });

                ffmpeg.on('error', (err) => {
                    console.error('Ошибка при запуске FFMPEG:', err);
                    reject(err);
                });
            });
        
            
            try{
                if (channel && channel.isTextBased()) {
                    await channel.send({
                        content: `Добро пожаловать ${member}!`,
                    });
                    await AltApi.sendfile(channel.id, BOT_DIR + `/tmp/${member.id}.gif`);
                }
                for(const tmp_file of [BOT_DIR + `/tmp/${member.id}.png`, BOT_DIR + `/tmp/${member.id}.gif`]){
                    fs.unlink(tmp_file, (error) => {
                        if(error != null){
                            low.logHandle(`Error: MakeWelko: fail to delit tmp file: ${error.message}`);
                        }else{
                            low.logHandle(`Временный файл ${tmp_file} удалён.`)
                        }
                    });
                }
            }catch(error){
                low.logHandle(`При обработке нового пользователя возникла ошибка: ${error as string}`)
            };

            
        }

        export async function LeaveMember(member: GuildMember | PartialGuildMember, channelId: string): Promise<void> {
            try {
                    const channel = member.guild.channels.cache.get(channelId) as TextChannel;
                    if (channel) {
                        const userInfo = {
                            content: `Участник ливнул: @${member.user.tag}`,
                            embeds: [{
                                title: "Информация о пользователе",
                                thumbnail: {
                                        url: member.user.displayAvatarURL()
                                },
                                fields: [
                                    { name: "Имя пользователя", value: member.user.username, inline: true },
                                    { name: "Тег", value: `#${member.user.discriminator}`, inline: true },
                                    { name: "ID пользователя", value: member.user.id, inline: true },
                                ],
                                color: 0xc33740
                            }]
                        };
                        await channel.send(userInfo);
                        console.log(`${member.user.tag} покинул сервер.`);
                    } else {
                        console.log('Канал для отправки сообщения не найден.');
                    }
            } catch (error) {   
                low.logHandle(`Ошибка при обработке пользователя покинувшего сервер: ${error}`);
            }
        }
    }

    /**
     * @low - наймспайс с приватными фунциями библиотеки, инкапсулируюшими определённые системные функции
     */
    export namespace low{
        export function combine_std_date(date: Date): string {
            const day: string = String(date.getDate()).padStart(2, '0');
            const month: string = String(date.getMonth() + 1).padStart(2, '0');
            const year: string = String(date.getFullYear()).slice(-2);

            return `${day}-${month}-${year}`;
        }

        export async function addRole(member: GuildMember, roleId: string, channelId: string): Promise<void> {
            try {
                const role: Role | undefined = member.guild.roles.cache.get(roleId);
                if (role) {
                    await member.roles.add(role);
                    console.log(`${member.user.tag} теперь имеет роль '${role.name}'`);
        
                    // Получаем канал по ID
                    const channel = member.guild.channels.cache.get(channelId) as TextChannel;
                    if (channel) {
                        // Формируем сообщение с информацией об участнике
                        const userInfo = {
                            content: `Новый участник: @${member.user.tag}`,
                            embeds: [{
                                title: "Информация о пользователе",
                                thumbnail: {
                                        url: member.user.displayAvatarURL() // Аватар пользователя
                                },
                                fields: [
                                    { name: "Имя пользователя", value: member.user.username, inline: true },
                                    { name: "Тег", value: `#${member.user.discriminator}`, inline: true },
                                    { name: "ID пользователя", value: member.user.id, inline: true },
                                ],
                                color: 0x9834db // фиолетовый цвет для сообщения
                            }]
                        };
                        
                        // Отправляем сообщение в канал
                        await channel.send(userInfo);
                        console.log(`${member.user.tag} зашёл на сервер.`);
                    } else {
                        console.log('Канал для отправки сообщения не найден.');
                    }
                } else {
                    console.log('Роль не найдена.');
                }
            } catch (error) {   
                console.error('Ошибка при добавлении роли и отправке сообщения:', error);
            }
        }
        export async function send_deletable_massage(channel: Channel, content: string, opt_time?: number): Promise<Message | null> {
            low.logHandle(`Отправлено предупреждаюшее сообшение: ${content}`);
            if (channel instanceof TextChannel) {
                const dotmessage = await channel.send(content);
                if (typeof(opt_time) == typeof(undefined)) {
                    setTimeout(async () => {
                        await dotmessage.delete();
                    }, 10_000
                    );
                } else {
                    setTimeout(async () => {
                        await dotmessage.delete();
                    }, opt_time
                    );
                }
                return dotmessage;
            }
            return null;
        }
        export async function send_deletable_reply(interect: ChatInputCommandInteraction, content: string | InteractionReplyOptions, time?: number ): Promise<InteractionResponse | null> {
            const {member, commandName, channel} = interect;
            if(channel instanceof TextChannel){
                const dotmessage = await interect.reply(content);
                if (typeof(time) == typeof(undefined)) {
                    setTimeout(async () => {
                        await dotmessage.delete();
                    }, 10_000
                    );
                } else {
                    setTimeout(async () => {
                        await dotmessage.delete();
                    }, time
                    );
                }
                return dotmessage;
            }
            return null;
        } 
        export async function logHandle(logContent: any, filePath?: string): Promise<void> {
            if(logContent instanceof String){
                logContent = logContent as string;
            }else if ( logContent instanceof Error){
                logContent = logContent.message;
            }else{
                try{
                    logContent = logContent as string;
                } catch {
                logContent = "Вызов logHandle с невалидным телом сообщения";
                }
            }

            const CD = new Date();

            const logEntry = `[${CD.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}]: ${logContent}\n`;
        
            console.log(logEntry);
            
            if(typeof(filePath) == typeof(undefined)){
                filePath = "./bruh.log";
            } else {
                filePath = filePath as string;
            }
            fs.appendFile(filePath, logEntry, (err) => {
                if (err) {
                    console.error('Ошибка при добавлении строки в файл:', err);
                }
            });
        }
        export function clearDir(directory: string): void {
            if (fs.existsSync(directory)) {
                const files = fs.readdirSync(directory);
                for (const file of files) {
                    fs.unlinkSync(path.join(directory, file));
                }
            }
        }
        export function createArchive(sourceDir: string, outputFile: string): Promise<void> {
            return new Promise((resolve, reject) => {
                const output = fs.createWriteStream(outputFile);
                const archive = archiver('zip', {
                    zlib: { level: 9 },
                });

                output.on('close', () => resolve());
                archive.on('error', (err) => reject(err));

                archive.pipe(output);
                archive.directory(sourceDir, false);
                archive.finalize();

                return archive;
            });
        }

        
        export function isModerator(member: GuildMember): boolean {

            if(member.permissions.has(PermissionFlagsBits.MuteMembers)){return true;}

            return false;
        }

    }

    
};



