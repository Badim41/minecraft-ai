const settings = {
    "minecraft_version": "1.20.4", // supports up to 1.21.1 <<< Хз, я проверял, у меня работает максимум 1.20.4
    "host": "127.0.0.1", // or "localhost", "your.ip.address.here"
    "port": 25565,
    "auth": "offline", // or "microsoft"

    // the mindserver manages all agents and hosts the UI
    "host_mindserver": true, // if true, the mindserver will be hosted on this machine. otherwise, specify a public IP address
    "mindserver_host": "localhost",
    "mindserver_port": 8080,
    "proxyserver_port": 8081,
    
    // the base profile is shared by all bots for default prompts/examples/modes
    "base_profile": "./profiles/defaults/survival.json", // survival.json, creative.json, god_mode.json
    "profiles": [
        "./max.json",
        // if you are using more than 1 profile, then 
        // - you can use /msg or @botname in order to talk to each bot indivually
        // - or you can use @all in order to talk to all the bots at the same time
        // individual profiles override values from the base profile
    ],
    "load_memory": false, // load memory from previous session
    "memory_bank_size": 20, // max number of facts to remember in memory bank
    "init_message": "Скажи 'всем привет' от своего имени", // sends to all on spawn
    "only_chat_with": [], // users that the bots listen to and send general messages to. if empty it will chat publicly
    "language": "en", // translate to/from this language. Supports these language names: https://cloud.google.com/translate/docs/languages
    "allow_insecure_coding": false, // allows newAction command and model can write/run code on your computer. enable at own risk
    "blocked_actions" : [], // commands to disable and remove from docs. Ex: ["!setMode"]
    // "blocked_actions" : ["!build", "!endBuild"],
    "code_timeout_mins": -1, // minutes code is allowed to run. -1 for no timeout
    "relevant_docs_count": 5, // number of relevant code function docs to select for prompting. -1 for all
    "max_messages": 15, // max number of messages to keep in context
    "num_examples": 2, // number of examples to give to the model
    "max_commands": -1, // max number of commands that can be used in consecutive responses. -1 for no limit
    "verbose_commands": true, // show full command syntax
    "narrate_behavior": true, // chat simple automatic actions ('Picking up item!')
    "chat_bot_messages": true, // publicly chat messages to other bots
    "plugins" : [], // plugin will be loaded if and only if it's name appears here
}

// these environment variables override certain settings
if (process.env.MINECRAFT_PORT) {
    settings.port = process.env.MINECRAFT_PORT;
}
if (process.env.MINDSERVER_PORT) {
    settings.mindserver_port = process.env.MINDSERVER_PORT;
}
if (process.env.PROFILES && JSON.parse(process.env.PROFILES).length > 0) {
    settings.profiles = JSON.parse(process.env.PROFILES);
}
export default settings;
