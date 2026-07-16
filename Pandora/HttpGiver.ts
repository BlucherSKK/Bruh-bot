import https from 'https';
import path, { resolve } from 'path';
import fs from 'fs';

export function sleep(s: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, s*1000));
}

export async function BR_set_file_downloadeable(path: string, port: number, host_name: string, access_time_seccond: number): Promise<void>
{
    const options = {
        key: fs.readFileSync('./server.key'), // Путь к приватному ключу
        cert: fs.readFileSync('./server.cert') // Путь к сертификату
    };

    let archivePath = `./${path}`;
    // Создаем HTTP-сервер
    const server = https.createServer(options, (req, res) => {
        if (req.url === `/download/${path}`) {
            // Проверяем, существует ли файл
            fs.access(archivePath, fs.constants.F_OK, (err) => {
                if (err) {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('File not found');
                    return;
                }

                // Отдаем файл
                res.writeHead(200, {
                    'Content-Type': 'application/zip',
                    'Content-Disposition': `attachment; filename="${path}"`,
                });
                const readStream = fs.createReadStream(archivePath);
                readStream.pipe(res);
            });
        } else {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Use /download/your-archive.zip to download the file');
        }
    });

    let downloadLink: string = "";

    server.listen(port, () => {
        downloadLink = `https://${host_name}:${port}/download/${path}`;
        console.log(`Download link: ${downloadLink}`);
    });

    await sleep(access_time_seccond);
    
    
    server.close(() => {
        console.log("Server stoped");
        return resolve();
    });
}
