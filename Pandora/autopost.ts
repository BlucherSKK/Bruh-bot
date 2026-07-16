import { Client, GatewayIntentBits, TextChannel, Message, EmbedBuilder } from 'discord.js';
import { readdirSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import * as fs from 'fs';
import * as path from 'path';
import { ContentChannels, BOT_DIR } from './constants';
import { createReadStream } from 'node:fs';
import { AltApi } from './parsing';
import { channel } from 'node:diagnostics_channel';


// Управляющие переменные
let SHEDILEPOSTSWITCH = 0;
const STORAGE_DIR = BOT_DIR + "/content";


async function multipost(client: Client) {
    console.log(`[${new Date().toLocaleTimeString()}] Начинаю обход каналов...`);

    for (const channelId of Object.keys(ContentChannels)) {
        const channelName = ContentChannels[channelId];
        const folderPath = join(STORAGE_DIR, channelId);

        console.log(`[BRUH AUTOPOST] Проверка канала: ${channelName} (ID: ${channelId})`);
        console.log(`[DEBUG] Ищу папку по пути: ${folderPath}`);

        if (existsSync(folderPath)) {
            const files = readdirSync(folderPath).filter(f => !f.startsWith('.'));
            console.log(`[DEBUG] Найдено файлов в папке: ${files.length}`);

            if (files.length > 0) {
                const fileName = files[0];
                const filePath = join(folderPath, fileName);

                try {
                    console.log(`[DEBUG] Запрос fetch для канала ${channelId}...`);
                    const channel = await client.channels.fetch(channelId);

                    if (channel instanceof TextChannel) {
                        console.log(`[DEBUG] Канал получен. Чтение файла: ${fileName}`);
                        await AltApi.sendfile(channelId, filePath);
                        unlinkSync(filePath);
                        console.log(`✅ Отправлено в ${channelName}: ${fileName}`);
                    }
                } catch (err) {
                    console.error(`❌ Ошибка выполнения в канале ${channelName}:`, err);
                }
            } else {
                console.log(`📁 ${channelName}: Материалы пусты`);
            }
        } else {
            console.log(`⚠️ ${channelName}: Папка не существует на диске`);
        }

        // Уменьшаем задержку до 3 секунд, чтобы не ждать по минуте
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
}

export function change_shedule_switch(value: number | undefined ) {
    SHEDILEPOSTSWITCH = value || 0;
}



let AUTOPOST_LAST: number = Date.now(); // Метка последнего запуска (Unix Time в мс)
let AUTOPOST_NOW: boolean = false;           // Та самая переменная-флаг
export function autopost_now(){
    AUTOPOST_NOW = true;
}
let AUTOPOST_DELAY = 24 * 60 * 60 * 1000;
let AUTOPOST_BUSY = false;
export async function autoPostScheduler(client: Client) {
    console.log("[BRUH] Мониторинг запущен...");

    setInterval(async () => {
        const now = Date.now();

        // Условие 1: Прошло 24 часа или более
        const isTimeExpired = now >= (AUTOPOST_LAST + AUTOPOST_DELAY);

        // Условие 2: Флаг изменился (стал true)
        const isFlagTriggered = AUTOPOST_NOW === true;

        if ((isTimeExpired || isFlagTriggered) && !AUTOPOST_BUSY) {

            AUTOPOST_BUSY = true;
            // 1. Запускаем целевую функцию
            await multipost(client);

            // 2. Сбрасываем флаг
            AUTOPOST_NOW = false;

            // 3. Передвигаем метку времени на "сейчас"
            AUTOPOST_LAST = now;

            if (SHEDILEPOSTSWITCH != 0){
                AUTOPOST_DELAY = SHEDILEPOSTSWITCH;
                SHEDILEPOSTSWITCH = 0;
            }

            console.log("Состояние сброшено, таймер обновлен.");
            AUTOPOST_BUSY = false;
        }
    }, 1000 * 60);
}
/**
 *
 * Главная управляющая функция (планировщик)
 */
export async function setSchedulePost(client: Client, nextRunTimer: Timer | null) {
    // 1. Выполняем полезную работу
    await multipost(client);

    // 2. Определяем время до следующего запуска
    let delayMs: number;

    if (SHEDILEPOSTSWITCH === 0) {
        delayMs = 24*60*60 * 1000; // 1 час в миллисекундах
        console.log(`Следующий запуск через 24 часa (SWITCH=0)`);
    } else {
        delayMs = SHEDILEPOSTSWITCH * 1000; // X секунд
        console.log(`Следующий запуск через ${SHEDILEPOSTSWITCH} сек. (SWITCH!=0)`);
    }

    // 3. Ставим задачу снова
    nextRunTimer = setTimeout(() => setSchedulePost(client, nextRunTimer), delayMs);
}

export async function checkquacontent(message: Message) {
    try {
        // Проверяем, существует ли путь
        if (!fs.existsSync(STORAGE_DIR)) {
            return message.reply(`Ошибка: Директория \`${STORAGE_DIR}\` не найдена.`);
        }

        const stats: { folder: string; count: number }[] = [];
        const items = fs.readdirSync(STORAGE_DIR);

        for (const item of items) {
            const fullPath = path.join(STORAGE_DIR, item);
            const isDirectory = fs.statSync(fullPath).isDirectory();

            if (isDirectory) {
                // Считаем только файлы внутри этой подпапки (без рекурсии вглубь)
                const files = fs.readdirSync(fullPath).filter(file =>
                fs.statSync(path.join(fullPath, file)).isFile()
                );

                stats.push({
                    folder: item,
                    count: files.length
                });
            }
        }

        if (stats.length === 0) {
            return message.reply('Контент закончился');
        }

        // Формируем красивый ответ через Embed
        const embed = new EmbedBuilder()
        .setTitle('📊 Количество контента для автопубликации')
        .setColor(0x00AE86)
        .setDescription(
            stats.map(s => `📁 <#${s.folder}>**: \`${s.count}\` файлов`).join('\n')
        )
        .setTimestamp();

        await message.reply({ embeds: [embed] });

    } catch (error) {
        console.error(error);
        await message.reply('Произошла ошибка при чтении директории.');
    }
}

