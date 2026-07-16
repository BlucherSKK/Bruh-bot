#!/bin/bash

replace_label() {
    LABEL=$2
    FILE=$1
    VALUE=$3

    # Проверка на наличие файла
    if [ ! -f "$FILE" ]; then
        echo "Ошибка: Файл $FILE не найден."
        return 1
    fi

    # Используем sed для замены.
    # В качестве разделителя используем | на случай, если в строке замены есть слеши
    sed "s|$LABEL|$VALUE|g" "$FILE" > "$FILE.tmp" && mv "$FILE.tmp" "$FILE"
}

prepare_release_dir() {
    # 1. Генерируем имя папки с датой
    TIMESTAMP=$(date +"%d-%m-%Y-%H-%M")
    TARGET_DIR="tmp/bruh-bot-$TIMESTAMP"

    # 2. Создаем структуру папок (-p создаст и tmp, и подпапку сразу)
    mkdir -p "$TARGET_DIR"

    # 3. Копируем все файлы из текущей директории (только файлы, не папки)
    # Используем find с maxdepth 1, чтобы не уйти в рекурсию
    find . -maxdepth 1 -type f -exec cp {} "$TARGET_DIR/" \;

    # 4. Копируем директории, переданные аргументами
    for dir in "$@"; do
        if [ -d "$dir" ]; then
            # Пропускаем папку tmp, если она попала в аргументы, чтобы не копировать саму себя
            if [ "$dir" = "tmp" ]; then continue; fi

            cp -r "$dir" "$TARGET_DIR/"
            echo "Скопирована директория: $dir"
        else
            echo "Предупреждение: Директория $dir не найдена, пропускаю."
        fi
    done

    echo "---"
    echo "Перенос соурскода в директорию сборки завершон: $TARGET_DIR"
}

push_to_dockerhub() {
    # 1. Параметры
    USERNAME=$1 # Замени на свой логин
    IMAGE_NAME=$2
    TAG=$3

    # Проверка аргументов
    if [ -z "$IMAGE_NAME" ] || [ -z "$TAG" ]; then
        echo "Ошибка: Используй: push_to_dockerhub <name> <tag>"
        return 1
    fi

    FULL_IMAGE_PATH="$USERNAME/$IMAGE_NAME:$TAG"
    LATEST_PATH="$USERNAME/$IMAGE_NAME:latest"

    echo "--- Начинаем сборку: $FULL_IMAGE_PATH ---"

    # 2. Сборка (Build)
    # Используем --pull чтобы всегда иметь свежие базовые образы
    docker build --pull -t "$FULL_IMAGE_PATH" .

    if [ $? -ne 0 ]; then
        echo "Ошибка при сборке образа!"
        return 1
    fi

    # 3. Тегируем как latest
    docker tag "$FULL_IMAGE_PATH" "$LATEST_PATH"

    # 4. Пуш (Push)
    echo "--- Пушим в Docker Hub ---"
    docker push "$LATEST_PATH"

    if [ $? -eq 0 ]; then
        echo "Успешно! Образ доступен как:"
        echo "$LATEST_PATH"
    else
        echo "Ошибка при пуше. Проверь 'docker login'."
        return 1
    fi
}
prepare_release_dir Pandora assets
TDIR=$TARGET_DIR
cd $TDIR

# 1. Запрашиваем ввод от пользователя
echo -n "Введите версию бота: "
read VERSION

# Проверяем, что ввод не пустой
if [ -z "$VERSION" ]; then
  echo "Ошибка: Версия не может быть пустой!"
  exit 1
fi

replace_label "./Pandora/Pandora.ts" "##VERSION##" $VERSION
replace_label "./Pandora/Pandora.ts" "##VERSIONDATE##" "$(date +"%d-%m-%Y")"
replace_label "main.ts" "##BUILDTIME##" "$(date +"%d-%m-%Y-%H-%M-%s")"
replace_label "main.ts" "##CONFIGFILE##" "config.ini"
replace_label "main.ts" "##TOKENJSON##" "config.json"

push_to_dockerhub "bluchergk" "bruh-bot" $VERSION

cd "../"

rm -rf $TDIR

echo "CI завершон"
