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
    REST, 
    ChatInputCommandInteraction, 
    InteractionResponse,  
    User,
    type MessageReplyOptions} from 'discord.js';
import { BruhFn } from './Pandora';
import fs from 'fs';
import {
    call_debug, 
    get_log_file,
    clear_anime_list,
    OneTimeSaver,
    command_list,
    get_bot_settings
} from "./adminCommand";
import type { Requa } from './adminCommand';
import { get } from 'http';
import { autopost_now, change_shedule_switch } from './autopost';
import { checkquacontent } from './autopost';

export async function message_command_handler(
    msg: Message,
    log_file: string,
    anime_list_path: string,
    host: string,
    client: Client,
    art_channles: string[],
    hentei_dir: string,
    accsept_chanles: string[],
    admin_channle_id: string,
    server: string,
    welkom_id: string,
    bot: string,
): Promise<void> {

    if(!(msg.content[0] == '_')){return;}
    
    if(!(is_moder_message(msg))){return;}
    if(!(msg.member instanceof GuildMember)){return;}

    switch(msg.content.split(" ")[0]){
        case "_check_content":
            await checkquacontent(msg);
            return;
        case "_change_post_delay":
        {
            if(msg.content.split(" ").length == 1){
                await msg_reply("A где блять значение то?", true, msg, true, 10);
                return;
            }
            const value: number = +msg.content.split(" ")[1];
            change_shedule_switch(value);
        }
        return;
        case "_get_logs":
            await get_log_file(msg, msg.member, log_file);
            await msg_reply("Файлы отправлены", true, msg, true, 10);
            return;
        case "_autopost_now":
            autopost_now();
            await msg_reply("Флаг автопоста выставлен, ожидайте ~5 минут", true, msg, true, 10);
            return;
        case "_clear_anime_list":
            await clear_anime_list(msg, anime_list_path);
            await msg_reply("Аниме лист очишен", true, msg, true, 10);
            return;
        
        case "_command_list":
            {
            const req = await command_list(msg, accsept_chanles);
            handle_admin_requa(req, msg);
            }
            return;

        case "__call_debug":
            if(is_guild_owner(msg)){
                await call_debug(msg, host, client);
            }
            msg_reply("Вызов call_debug завершён", true, msg, true);
            return;
        case "_get_bot_settings":
            {
            const req = await get_bot_settings(msg, accsept_chanles, {
                accesapted_chanles: accsept_chanles,
                admin_channle: admin_channle_id,
                saveable_channles: art_channles,
                server_id: server,
                wellkom: welkom_id,
                host: host,
                bot_id: bot,
            });
            handle_admin_requa(req, msg);
            }
            return;

        default:
            return;
            
    }


    
}

export async function msg_reply(
    rep: string | MessagePayload | MessageReplyOptions, 
    del_msg: boolean = true,
    msg: Message,
    del_reply: boolean = true,
    dely_del_rep: number = 10,
): Promise<void> {
    let reply = await msg.reply(rep);
    if(del_msg){
        try{
            msg.delete();
        } catch {
            BruhFn.low.logHandle(`Ошибка удоления админской комманды: ${msg.content}`);
        }
    }
    if(del_reply){
        setTimeout(async () => {
            try {
                await reply.delete();
            } catch (err) {
                BruhFn.low.logHandle(err);
            }
        }, dely_del_rep * 1000);
    }
    
}



export function is_moder_message(message: Message): boolean {
  if (!message.guild || !message.member) return false; // ЛС или отсутствующий member

  // Системные права (часто используются для модерации)
  if (message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return true;

  // Роль по имени (поменяйте на нужное название или уберите)
  if (message.member.roles.cache.some(r => r.name.toLowerCase() === 'moderator')) return true;

  // Можно считать владельца сервера модератором
  if (message.guild.ownerId === message.author.id) return true;

  return false;
}


async function handle_admin_requa(req: Requa, msg: Message) {

    if(req == undefined){return;}

    if(req.content !== undefined){
        msg_reply(req.content, req.del_msg, msg,req.del_rep, req.del_rep_dely)
    } else {
        if(req.del_msg == undefined || req.del_msg == true){
            msg.delete();
        }
    }
    return;
}



function is_guild_owner(message: Message): boolean {
    if (!message.guild || !message.member) return false; 
    if (message.guild.ownerId === message.author.id) return true;

    return false;
}
