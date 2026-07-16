import * as fs from 'fs';
import * as ini from 'ini';
import { BruhFn } from './Pandora';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ContentChannels, DIS_TOKEN } from './constants';
const execPromise = promisify(exec);


export namespace AltApi{
    /**
    * Отправляет файл в Discord через системный curl
    * @param channelId ID канала
    * @param token Токен бота
    * @param filePath Абсолютный путь к файлу
    */
    export async function sendfile(channelId: string, filePath: string) {

        const token = DIS_TOKEN;
        const acs_channles = Object.keys(ContentChannels);
        acs_channles.push("1300748858808336435");
        if(!(acs_channles.includes(channelId))) {
            console.error("[BRUH ALT API ERROR] недопустимый канал " + channelId);
            return;
        }

        const url = `https://discord.com/api/v10/channels/${channelId}/messages`;

        // Формируем команду curl точно так же, как в твоем успешном тесте
        // Флаг -S -s убирает лишний вывод прогресса, но оставляет ошибки
        const curlCommand = `curl -X POST -H "Authorization: Bot ${token}" \
        -F "file=@${filePath}" \
        "${url}"`;

        try {
            const { stdout, stderr } = await execPromise(curlCommand);

            // Проверяем, нет ли в ответе Discord ошибки JSON-ом
            if (stdout.includes('"code"')) {
                const response = JSON.parse(stdout);
                if (response.code) {
                    throw new Error(`Discord API Error: ${response.message} (Code: ${response.code})`);
                }
            }

            return JSON.parse(stdout);
        } catch (error) {
            console.error(`[CURL FAIL] Ошибка при отправке файла через curl:`, error);
            throw error;
        }
    }

}

export namespace files_io{
    export function ini_get_config_value(fileContent: string, head: string, key: string): string[] {

        // Парсим содержимое файла в объект
        const config = ini.parse(fileContent);

        // Извлекаем ids и преобразуем строку в массив
        const idsString = config[head]?.[key];
        if (idsString) {
            return idsString.split(',').map((id: string) => id.trim()); // Преобразуем строку в массив
        }

        console.error("Ошибка парсинга конфиг файла")
        return [];
    }

    export function random_anime_und_move(filePath: string, lineNumber: number): String | null | Error{
        try {
        // Читаем содержимое файла
        const data = fs.readFileSync(filePath, 'utf-8');
        const lines = data.split('\n'); // Разделяем содержимое на строки

        console.log(lines.length);
        console.log(lineNumber)
        // Проверяем, существует ли строка с указанным номером
        if (lineNumber > (lines.length - 1)) {
            return new Error('Неверный номер строки.');
        }

        // Получаем строку (уменьшаем на 1, так как массив начинается с 0)
        const lineToReturn = lines[lineNumber];

        // Удаляем строку из массива
        lines.splice(lineNumber, 1);

        // Записываем обновлённые строки обратно в файл
        fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');

        return lineToReturn; // Возвращаем удалённую строку
        } catch (error) {
            BruhFn.low.logHandle(`Ошибка: ${error as string}`);
            return null; // Возвращаем null в случае ошибки
        }
    }

    export function add_anime_to_file(filePath: string, data: string): void {
        fs.appendFile(filePath, data + '\n', (err) => {
            if (err) {
                BruhFn.low.logHandle(`Ошибка при добавлении anime в файл: ${err.message}`);
            } else {
                BruhFn.low.logHandle(`Аниме ${data} успешно добавлена в файл ${filePath}`);
            }
        });
    }
}
