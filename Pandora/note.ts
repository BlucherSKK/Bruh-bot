import { Client, GuildMember, TextChannel } from "discord.js";
import { 
    BruhFn,
} from "./Pandora";
import { ADMIN_CHANNEL_ID } from "../main";
import { Colors } from "discord.js";


export enum BruhNotifyType {
    PixivServerUP,
    Error,
    CurlError
}

const BruhNotifyColors: Record<BruhNotifyType, number> = {
    [BruhNotifyType.PixivServerUP] : Colors.Aqua,
    [BruhNotifyType.Error] : Colors.Red,
    [BruhNotifyType.CurlError] : Colors.Red
}

const BruhNotifyTitle: Record<BruhNotifyType, string> = {
    [BruhNotifyType.PixivServerUP] : "Pixiv Hendler поднят",
    [BruhNotifyType.Error] : "Возникла ошибка",
    [BruhNotifyType.CurlError] : "Возникла ошибка при использовании алитернативного апи"
}

export async function bruh_notify(msg: string, client: Client, type: BruhNotifyType) {
    try {
        const channel = await client.channels.fetch(ADMIN_CHANNEL_ID) as TextChannel;
        if (channel) {
            const userInfo = {
                embeds: [{
                    title: BruhNotifyTitle[type],
                    footer: {
                        text: `${msg}`
                    },
                    color: BruhNotifyColors[type]
                }]
            };
            await channel.send(userInfo);
            console.log(`[BRUH] ${BruhNotifyTitle[type]} ${msg}`);
        } else {
            console.log('Канал для отправки сообщения не найден.');
        }
    } catch (error) {
        console.error(`Блять не удалось обработать ошибку: ${error}`);
    }
}


export async function call(mod: GuildMember, mes: string): Promise<void> {
    mod.send({
                    embeds: [{
                        title: "Аааахтунг",
                        footer: {
                            text: `${mes}`
                        },
                        color: BruhFn.COLOR.AHTUNG
                    }]
                });
}

export async function get_moder(mod_id: string, client: Client, guild_id: string): Promise<GuildMember | null> {
    
    const guild = await client.guilds.fetch(guild_id);
    
    let member = null;

    try {
        member = await guild.members.fetch(mod_id);
    } catch (error) {
        member = null;
        BruhFn.low.logHandle(error);
    }

    console.log("Админ получен");
    return member;
}
