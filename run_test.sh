#!/bin/bash

# Тестовый запуск бота с test.ini и test.json
# Переменные окружения BOT_CONFIG_FILE и BOT_TOKEN_FILE переопределяют
# дефолтные значения маркеров ##CONFIGFILE## / ##TOKENJSON## в main.ts

echo "--- Запуск бота с test.ini и test.json ---"
BOT_CONFIG_FILE=test.ini BOT_TOKEN_FILE=test.json npx tsx main.ts
