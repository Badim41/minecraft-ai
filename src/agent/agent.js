import { History } from './history.js';
import { Coder } from './coder.js';
import { Prompter } from '../models/prompter.js';
import { initModes } from './modes.js';
import { initBot } from '../utils/mcdata.js';
import { containsCommand, commandExists, executeCommand, truncCommandMessage, isAction, blacklistCommands } from './commands/index.js';
import { ActionManager } from './action_manager.js';
import { PluginManager } from './plugin.js';
import { SelfPrompter } from './self_prompter.js';
import convoManager from './conversation.js';
import { handleTranslation, handleEnglishTranslation } from '../utils/translator.js';
import settings from '../../settings.js';
import { serverProxy } from './agent_proxy.js';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { dirname, resolve } from 'path';

export class Agent {
    async start(profile_fp, load_mem=false, init_message=null, count_id=0) {
        this.last_sender = null;
        this.count_id = count_id;
        if (!profile_fp) {
            throw new Error('No profile filepath provided');
        }
        
        console.log('Starting agent initialization with profile:', profile_fp);
        
        // Initialize components with more detailed error handling
        console.log('Initializing action manager...');
        this.actions = new ActionManager(this);
        console.log('Initializing prompter...');
        this.prompter = new Prompter(this, profile_fp);
        this.name = this.prompter.getName();
        console.log('Initializing history...');
        this.history = new History(this);
        console.log('Initializing coder...');
        this.coder = new Coder(this);
        console.log('Initializing plugin manager...');
        this.plugin = new PluginManager(this);
        console.log('Initializing self prompter...');
        this.self_prompter = new SelfPrompter(this);
        convoManager.initAgent(this);            
        console.log('Initializing examples...');
        await this.prompter.initExamples();
        blacklistCommands(settings.blocked_actions);

        // for Generative Agents 

        serverProxy.connect(this);

        console.log(this.name, 'logging into minecraft...');
        this.bot = initBot(this.name);

        initModes(this);

        let save_data = null;
        if (load_mem) {
            save_data = this.history.load();
        }

        this.bot.on('login', () => {
            console.log(this.name, 'logged in!');

            serverProxy.login();
            
            // Set skin for profile, requires Fabric Tailor. (https://modrinth.com/mod/fabrictailor)
            if (this.prompter.profile.skin) {
                if (this.prompter.profile.skin.path) {
                    this.bot.chat(`/skin set URL ${this.prompter.profile.skin.model} ${this.prompter.profile.skin.path}`);
                }
                if (this.prompter.profile.skin.file) {
                    let skin_path = this.prompter.profile.skin.file 
                    if (skin_path.startsWith("~")) {
                        skin_path = homedir() + skin_path.slice(1)
                    }
                    this.bot.chat(`/skin set upload ${this.prompter.profile.skin.model} ${skin_path}`);
                } 
            } else {
                this.bot.chat(`/skin clear`);
            }
        });

        this.bot.on('change_suit', () =>{
        })

        const spawnTimeout = setTimeout(() => {
            process.exit(0);
        }, 30000);
        this.bot.once('spawn', async () => {
            try {
                clearTimeout(spawnTimeout);
                // wait for a bit so stats are not undefined
                await new Promise((resolve) => setTimeout(resolve, 1000));
                
                console.log(`${this.name} spawned.`);
                this.clearBotLogs();

                this._setupEventHandlers(save_data, init_message);
                this.startEvents();

            } catch (error) {
                console.error('Error in spawn event:', error);
                process.exit(0);
            }
        });
    }

    async _setupEventHandlers(save_data, init_message) {
        const ignore_messages = [
            "Set own game mode to",
            "Set the time to",
            "Set the difficulty to",
            "Teleported ",
            "Set the weather to",
            "Gamerule "
        ];

        // Отключаем обработку чата для команд
        const respondAtFunc = async (username, message) => {
            // Игнорируем команды из чата
            console.log(`Chat message from ${username} ignored: ${message}`);
        }

        const respondFunc = async (username, message) => {
            // Игнорируем команды из чата
            console.log(`Whisper from ${username} ignored: ${message}`);
        }

        this.respondAtFunc = respondAtFunc
        this.respondFunc = respondFunc

        this.bot.on('chat', respondAtFunc);
        this.bot.on('whisper', respondFunc);

        // Set up auto-eat
        this.bot.autoEat.options = {
            priority: 'foodPoints',
            startAt: 14,
            bannedFood: ["rotten_flesh", "spider_eye", "poisonous_potato", "pufferfish", "chicken"]
        };

        if (save_data?.self_prompt) {
            if (init_message) {
                this.history.add('system', init_message);
            }
            await this.self_prompter.handleLoad(save_data.self_prompt, save_data.self_prompting_state);
        }
        if (save_data?.last_sender) {
            this.last_sender = save_data.last_sender;
            if (convoManager.otherAgentInGame(this.last_sender)) {
                // TRANSLATED_RU
                const msg_package = {
                    message: `Вы перезапустились, и это сообщение сгенерировано автоматически. Продолжите разговор со мной.`,
                    start: true
                };
                convoManager.receiveFromBot(this.last_sender, msg_package);
            }
        }
        else if (init_message) {
            await this.handleMessage('system', init_message, 2);
        }
        else {
            // Не отправляем приветствие в чат
            console.log("Agent started: " + this.name);
        }
    }

    // Добавим новый метод для обработки API команд
    async handleApiCommand(command, requestId) {
        const originalOpenChat = this.openChat.bind(this);
        const responses = [];

        // Перехватываем все выводы
        this.openChat = (message) => {
            responses.push({
                type: 'chat',
                message: message,
                timestamp: Date.now()
            });
        };

        // Перехватываем системные сообщения
        const originalHistoryAdd = this.history.add.bind(this.history);
        this.history.add = (source, message) => {
            if (source === 'system') {
                responses.push({
                    type: 'system',
                    message: message,
                    timestamp: Date.now()
                });
            }
            return originalHistoryAdd(source, message);
        };

        try {
            // Обрабатываем команду
            await this.handleMessage('api', command, -1);

            // Отправляем все ответы
            for (const response of responses) {
                serverProxy.getSocket().emit('api-response', requestId, response);
            }
        } finally {
            // Восстанавливаем оригинальные методы
            this.openChat = originalOpenChat;
            this.history.add = originalHistoryAdd;

            // Сигнализируем о завершении обработки
            serverProxy.getSocket().emit('api-command-complete', requestId);
        }
    }

    // Добавим метод для получения информации о боте
    getBotInfo() {
        const bot = this.bot;
        return {
            name: this.name,
            position: bot.entity ? {
                x: bot.entity.position.x,
                y: bot.entity.position.y,
                z: bot.entity.position.z
            } : null,
            health: bot.health,
            food: bot.food,
            saturation: bot.foodSaturation,
            experience: {
                level: bot.experience.level,
                points: bot.experience.points,
                progress: bot.experience.progress
            },
            gameMode: bot.game.gameMode,
            dimension: bot.game.dimension,
            inventory: bot.inventory.items().map(item => ({
                name: item.name,
                count: item.count,
                slot: item.slot,
                displayName: item.displayName,
                stackSize: item.stackSize
            })),
            equipped: {
                hand: bot.inventory.slots[bot.getEquipmentDestSlot('hand')]?.name || null,
                offhand: bot.inventory.slots[bot.getEquipmentDestSlot('off-hand')]?.name || null,
                head: bot.inventory.slots[bot.getEquipmentDestSlot('head')]?.name || null,
                torso: bot.inventory.slots[bot.getEquipmentDestSlot('torso')]?.name || null,
                legs: bot.inventory.slots[bot.getEquipmentDestSlot('legs')]?.name || null,
                feet: bot.inventory.slots[bot.getEquipmentDestSlot('feet')]?.name || null,
            },
            isMoving: bot.pathfinder?.isMoving() || false,
            currentAction: this.actions.currentActionLabel || 'idle',
            lastDamage: {
                time: bot.lastDamageTime,
                amount: bot.lastDamageTaken
            },
            nearbyPlayers: Object.values(bot.players)
                .filter(player => player.entity)
                .map(player => ({
                    username: player.username,
                    distance: bot.entity.position.distanceTo(player.entity.position),
                    position: {
                        x: player.entity.position.x,
                        y: player.entity.position.y,
                        z: player.entity.position.z
                    }
                })),
            time: {
                day: bot.time.day,
                timeOfDay: bot.time.timeOfDay,
                phase: bot.time.phase,
                moonPhase: bot.time.moonPhase
            }
        };
    }

    requestInterrupt() {
        this.bot.interrupt_code = true;
        this.bot.stopDigging();
        this.bot.collectBlock.cancelTask();
        this.bot.pathfinder.stop();
        this.bot.pvp.stop();
    }

    clearBotLogs() {
        this.bot.output = '';
        this.bot.interrupt_code = false;
    }

    shutUp() {
        this.shut_up = true;
        if (this.self_prompter.isActive()) {
            this.self_prompter.stop(false);
        }
        convoManager.endAllConversations();
    }

    async handleMessage(source, message, max_responses=null) {
        if (!source || !message) {
            console.warn('Received empty message from', source);
            return false;
        }

        let used_command = false;
        if (max_responses === null) {
            max_responses = settings.max_commands === -1 ? Infinity : settings.max_commands;
        }
        if (max_responses === -1) {
            max_responses = Infinity;
        }

        const self_prompt = source === 'system';
        const from_other_bot = convoManager.isOtherAgent(source);


        if (!self_prompt && !from_other_bot) { // from user, check for forced commands
            const user_command_name = containsCommand(message);
            if (user_command_name) {
                if (!commandExists(user_command_name)) {
                    this.routeResponse(source, `Command '${user_command_name}' does not exist.`);
                    return false;
                }
                this.routeResponse(source, `*${source} used ${user_command_name.substring(1)}*`);
                if (user_command_name === '!newAction') {
                    // all user-initiated commands are ignored by the bot except for this one
                    // add the preceding message to the history to give context for newAction
                    this.history.add(source, message);
                }
                let execute_res = await executeCommand(this, message);
                if (execute_res) 
                    this.routeResponse(source, execute_res);
                return true;
            }
        }

        if (from_other_bot)
            this.last_sender = source;

        // Now translate the message
//        message = await handleEnglishTranslation(message);
//        console.log('received message from', source, ':', message);
        console.log('получено сообщение от', source, ':', message);

        const checkInterrupt = () => this.self_prompter.shouldInterrupt(self_prompt) || this.shut_up || convoManager.responseScheduledFor(source);
        
        let behavior_log = this.bot.modes.flushBehaviorLog().trim();
        if (behavior_log.length > 0) {
            const MAX_LOG = 500;
            if (behavior_log.length > MAX_LOG) {
                behavior_log = '...' + behavior_log.substring(behavior_log.length - MAX_LOG);
            }
            behavior_log = 'Recent behaviors log: \n' + behavior_log;
            await this.history.add('system', behavior_log);
        }

        // Handle other user messages
        await this.history.add(source, message);
        this.history.save();

        if (!self_prompt && this.self_prompter.isActive()) // message is from user during self-prompting
            max_responses = 1; // force only respond to this message, then let self-prompting take over

        for (let i=0; i<max_responses; i++) {
            if (checkInterrupt()) break;
            let history = this.history.getHistory();
            let res = await this.prompter.promptConvo(history);

            console.log(`${this.name} full response to ${source}: ""${res}""`);
            
            if (res.trim().length === 0) { 
                console.warn('no response')
                break; // empty response ends loop
            }

            let command_name = containsCommand(res);

            if (command_name) { // contains query or command
                res = truncCommandMessage(res); // everything after the command is ignored
                this.history.add(this.name, res);
                
                if (!commandExists(command_name)) {
                    this.history.add('system', `Command ${command_name} does not exist.`);
                    console.warn('Agent hallucinated command:', command_name)
                    continue;
                }

                if (checkInterrupt()) break;
                this.self_prompter.handleUserPromptedCmd(self_prompt, isAction(command_name));

                if (settings.verbose_commands) {
                    this.routeResponse(source, res);
                }
                else { // only output command name
                    let pre_message = res.substring(0, res.indexOf(command_name)).trim();
                    let chat_message = `*used ${command_name.substring(1)}*`;
                    if (pre_message.length > 0)
                        chat_message = `${pre_message}  ${chat_message}`;
                    this.routeResponse(source, chat_message);
                }

                let execute_res = await executeCommand(this, res);

                console.log('Agent executed:', command_name, 'and got:', execute_res);
                used_command = true;

                if (execute_res)
                    this.history.add('system', execute_res);
                else
                    break;
            }
            else { // conversation response
                this.history.add(this.name, res);
                this.routeResponse(source, res);
                break;
            }
            
            this.history.save();
        }
        return used_command;
    }

    async routeResponse(to_player, message) {
        if (this.shut_up) return;
        let self_prompt = to_player === 'system' || to_player === this.name;
        if (self_prompt && this.last_sender) {
            // this is for when the agent is prompted by system while still in conversation
            // so it can respond to events like death but be routed back to the last sender
            to_player = this.last_sender;
        }

        if (convoManager.isOtherAgent(to_player) && convoManager.inConversation(to_player)) {
            // if we're in an ongoing conversation with the other bot, send the response to it
            convoManager.sendToBot(to_player, message);
        }
        else {
            // otherwise, use open chat
            this.openChat(message);
            // note that to_player could be another bot, but if we get here the conversation has ended
        }
    }

    toTranslate(message) {
        let to_translate = message;
        let remaining = '';
        let command_name = containsCommand(message);
        let translate_up_to = command_name ? message.indexOf(command_name) : -1;
        if (translate_up_to != -1) { // don't translate the command
            to_translate = to_translate.substring(0, translate_up_to);
            remaining = message.substring(translate_up_to);
        }
        return [to_translate, remaining];
    }

    async openChat(message) {
        let [to_translate, remaining] = this.toTranslate(message);
//        let translated_msg = (await handleTranslation(to_translate)).trim();
//        message =  translated_msg + " " + remaining;
        let translated_msg = to_translate.trim();
        message = translated_msg + " " + remaining;
        // newlines are interpreted as separate chats, which triggers spam filters. replace them with spaces
        message = message.replaceAll('\n', ' ');

        if (settings.only_chat_with.length > 0) {
            for (let username of settings.only_chat_with) {
                this.bot.whisper(username, message);
            }
        }
        else {
            
            this.bot.chat(message);
        }
    }

    startEvents() {
        // Custom events
        this.bot.on('time', () => {
            if (this.bot.time.timeOfDay >= 0 && this.bot.time.timeOfDay < 20) {
                this.bot.emit('sunrise');
            } else if (this.bot.time.timeOfDay >= 6000 && this.bot.time.timeOfDay < 6020) {
                this.bot.emit('noon');
            } else if (this.bot.time.timeOfDay >= 12000 && this.bot.time.timeOfDay < 12020) {
                this.bot.emit('sunset');
            } else if (this.bot.time.timeOfDay >= 18000 && this.bot.time.timeOfDay < 18020) {
                this.bot.emit('midnight');
            }
        });
        
        let prev_health = this.bot.health;
        this.bot.lastDamageTime = 0;
        this.bot.lastDamageTaken = 0;
        this.bot.on('health', () => {
            if (this.bot.health < prev_health) {
                this.bot.lastDamageTime = Date.now();
                this.bot.lastDamageTaken = prev_health - this.bot.health;
            }
            prev_health = this.bot.health;
        });
        // Logging callbacks
        this.bot.on('error' , (err) => {
            console.error('Error event!', err);
        });
        this.bot.on('end', (reason) => {
            console.warn('Bot disconnected! Killing agent process.', reason)
            this.cleanKill('Bot disconnected! Killing agent process.');
        });
        this.bot.on('death', () => {
            this.actions.cancelResume();
            this.actions.stop();
        });
        this.bot.on('kicked', (reason) => {
            console.warn('Bot kicked!', reason);
            this.cleanKill('Bot kicked! Killing agent process.');
        });
        this.bot.on('messagestr', async (message, _, jsonMsg) => {
            if (jsonMsg.translate && jsonMsg.translate.startsWith('death') && message.startsWith(this.name)) {
                console.log('Agent died: ', message);
                let death_pos = this.bot.entity.position;
                let death_pos_text = null;
                if (death_pos) {
                    death_pos_text = `x: ${death_pos.x.toFixed(2)}, y: ${death_pos.y.toFixed(2)}, z: ${death_pos.x.toFixed(2)}`;
                }
                let dimention = this.bot.game.dimension;
                // TRANSLATED_RU
                this.handleMessage('system', `Вы умерли в позиции ${death_pos_text || "неизвестно"} в измерении ${dimention} с последним сообщением: '${message}'. Место смерти сохранено как 'last_death_position', если вы хотите вернуться. Предыдущие действия были остановлены, и вы возродились.`);
            }
        });
        this.bot.on('idle', () => {
            this.bot.clearControlStates();
            this.bot.pathfinder.stop(); // clear any lingering pathfinder
            this.bot.modes.unPauseAll();
            this.actions.resumeAction();
        });

        // Init plugin manager
        this.plugin.init();

        // This update loop ensures that each update() is called one at a time, even if it takes longer than the interval
        const INTERVAL = 300;
        let last = Date.now();
        setTimeout(async () => {
            while (true) {
                let start = Date.now();
                await this.update(start - last);
                let remaining = INTERVAL - (Date.now() - start);
                if (remaining > 0) {
                    await new Promise((resolve) => setTimeout(resolve, remaining));
                }
                last = start;
            }
        }, INTERVAL);

        this.bot.emit('idle');
    }

    async update(delta) {
        await this.bot.modes.update();
        this.self_prompter.update(delta);
    }

    isIdle() {
        return !this.actions.executing;
    }
    
    cleanKill(msg='Killing agent process...', code=1) {
        this.history.add('system', msg);
        this.bot.chat(code > 1 ? 'Restarting.': 'Exiting.');
        this.history.save();
        process.exit(code);
    }

    killAll() {
        serverProxy.shutdown();
    }
}
