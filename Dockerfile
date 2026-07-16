FROM node:20-slim

# Установка proxychains-ng
# ... (начало вашего Dockerfile)

# 1. Убедитесь, что proxychains4 установлен
RUN apt-get update && apt-get install -y \
    proxychains4 ffmpeg curl\
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install
RUN mkdir /bot
# ... после COPY . .
COPY . .
RUN mkdir -p /bot/tmp && chmod 777 /bot/tmp



# 2. Копируем конфиг (убедитесь, что путь в контейнере совпадает с версией пакета)
COPY proxychains.conf /etc/proxychains4.conf

# 3. Запуск через proxychains4
# Важно: мы вызываем proxychains4 перед всей командой Node
CMD ["sh", "-c", "proxychains4 -f /etc/proxychains4.conf npx tsx main.ts; status=$?; echo 'Процесс завершен, ожидаем 10 минут...'; sleep 600; exit $status"]
