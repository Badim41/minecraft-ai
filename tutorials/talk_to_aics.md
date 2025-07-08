# Talk to Bots 

Once a AI character (bot) joins your Minecraft game, you can interact with it just like you would with another player—through the in-game **chat window**.

To open the chat:
- Press **T** on your keyboard (or `/` to open with a leading slash)
- Type your message and hit **Enter**

The bot will read general messages from the chat and respond if relevant.

Example:

```
Hi Max, what are you doing?
```

Then the bot will parse and respond accordingly. You can also send some command, and wait to see what the bot resonses. For example,

```
Hi Max, come here. 
```

---

## 👥 Talk to All Bots with `@all`

When multiple bots are active, it's helpful to broadcast a message to all of them at once.

To do this, prefix your message with `@all`:

```
@all come here
```

Every bot currently connected will receive this message and respond according to its individual logic.

---

## 🔊 Talk to a Specific Bot with `/msg` or `@name`

You can send a **private (whisper)** message to a specific bot using one of two methods:

### Option A: Use `/msg` (standard Minecraft whisper)

```

/msg Max follow me

```

This sends a private message to the bot named `Max`.

### Option B: Use `@name` (shortcut for whispering)

```

@Max follow me

```

This is functionally equivalent to `/msg Max follow me` and is more natural when chatting casually.

> ✅ Use this method when you want to give instructions to a single bot without alerting others.

---

## Bot Behavior Notes

- Whispered messages (`/msg` or `@name`) are prioritized by many bots over general chat.
- If you rename your bot in its profile (e.g. `"name": "Lucy"`), be sure to use the updated name when whispering.

---

This system makes it easy to manage interactions with multiple AICs in a collaborative world.



