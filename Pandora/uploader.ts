import express from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

export function inituploader(accessWord: string) {
    const app = express();
    const port = 3000;
    let fileCounter = 0;

    const BASE_UPLOAD_DIR = path.join(__dirname, 'content');

    const storage = multer.diskStorage({
        destination: (req: Request, file: File, cb) => {
            const subFolder = req.body.targetFolder || 'default';
            const fullPath = path.join(BASE_UPLOAD_DIR, subFolder);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
            }
            cb(null, fullPath);
        },
        filename: (req: Request, file, cb) => {
            fileCounter++;
            const fileExt = path.extname(file.originalname);
            cb(null, `${fileCounter}${fileExt}`);
        }
    });

    const upload = multer({ storage });

    app.get('/:accessword', (req: Request, res: Response) => {
        if (req.params.accessword !== accessWord) {
            return res.status(403).json({ error: 'Доступ запрещен: неверное кодовое слово' });
        }
        res.sendFile(path.join(__dirname, 'uploader.html'));
    });

    // Маршрут с проверкой accessword
    app.post('/upload/:accessword', (req: Request, res: Response, next) => {
        // Сверяем слово из URL с тем, что передали в функцию
        if (req.params.accessword !== accessWord) {
            console.log(`попытка доступа с токеном ${req.params.accessword}`)
            return res.status(403).json({ error: `Доступ запрещен: неверное кодовое слово ${req.params.accessword}` });
        }
        next();
    }, upload.array('files'), (req: Request, res: Response) => {
        res.json({
            success: true,
            folder: req.body.targetFolder,
            lastId: fileCounter
        });
    });

    app.listen(port, () => {
        console.log(`Сервер запущен. URL для загрузки: http://localhost:${port}/${accessWord}`);
    });
}


