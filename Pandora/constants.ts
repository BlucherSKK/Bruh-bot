import { TOKEN } from '../config.json';
export const DIS_TOKEN = TOKEN;

export const BOT_DIR = "/bot";


export const ContentChannels: Record<string, string> = {
    "1239834885666115604": "GFL SFW",
    "1239834985091829782": "GFL NSFW pg13",
    "1272864940163727371": "GFL NSFW r18",
    "1246550242225295473": "GFL memes",
    "1271543973139452035": "GFL manga",
    "1283504157252255846": "Kedr SFW",
    "1283504205021319249": "Kedr NSFW",
    "1283504282565607444": "Kedr memes",
    "1239893973980418078": "manga",
    "1315371661557628928": "Limbus",
    "1323318429981216818": "Awaria",
    "1408716631516905553": "Umamusume",
    "1239852139329880114": "Azur Lane",
    "1239863128221552660": "Arknights",
    "1275685107889344552": "Zenless Zone Zero",
    "1278340170847879232": "Blue Archive",
    "1376610610640322671": "Nikke",
    "1239996428030443550": "Girls und Panzer",
    "1280255818142318695": "Тянки в форме",
    "1239855334483427419": "OFF"
};


export const TAG_MAPPING: Record<string, string | string[]> = {
    // Arknights
    "arknights": "Arknights",
    // Girls' Frontline
    "girls'_frontline": ["GFL SFW", "GFL NSFW pg13", "GFL NSFW r18"],
    "girls_frontline": ["GFL SFW", "GFL NSFW pg13", "GFL NSFW r18"],

    // Kedr (Для таких узких тегов лучше использовать общее название серии)
    "cedar_games": ["Kedr SFW", "Kedr NSFW"],
    // Limbus Company
    "limbus_company": "Limbus",

    // Umamusume
    "uma_musume_pretty_derby": "Umamusume",
    "uma_musume": "Umamusume",

    // Azur Lane
    "azur_lane": "Azur Lane",

    // Zenless Zone Zero
    "zenless_zone_zero": "Zenless Zone Zero",

    // Blue Archive
    "blue_archive": "Blue Archive",


    // Nikke
    "goddess_of_victory:_nikke": "Nikke",
    "nikke": "Nikke",

    // Girls und Panzer
    "girls_und_panzer": "Girls und Panzer",

    // Общие теги (Тянки в форме)
    "military_uniform": "Тянки в форме",
    "girl_with_gun": "Тянки в форме"
};
