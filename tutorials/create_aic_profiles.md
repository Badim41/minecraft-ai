# Create Bot Profiles

Minecraft AI characters (AI bots) are defined through **profile files** written in JSON. Each profile shapes the bot's name, personality, appearance, and behavior model—allowing you to craft intelligent, expressive, and goal-driven in-game companions.

This guide walks you through how to create a bot profile that matches your intended design.

🔬 *Try the visual toolkit to create bot profiles:* [Original Character for Minecraft AI](https://minecraft-ai-oc-creator.vercel.app/)

---

## 1. Create the Profile File

Start by creating a new JSON file anywhere you like to keep it. For example, create:

```
profiles/max.json
```

---

## 2. Set Basic Identity

Each bot needs a unique `name`. You can also optionally specify a Minecraft skin:

```json
"name": "Max",
"skin": {
  "model": "classic",
  "file": "~/Projects/minecraft-ai/skins/max.png"
}
```

* `name`: How the bot appears in chat and the game world.
* `model`: `"classic"` or `"slim"` depending on the skin format.
* `file`: **Absolute path** to the `.png` skin image file.

---

## 3. Define the Bot’s Personality

The `person_desc` field gives your bot its "voice" and behavioral tone.

```json
"person_desc": "A smart Minecraft agent following own heart! Pragmatic, focused, and a little reserved..."
```

This should describe **how** the bot thinks, reacts, speaks, and moves. It shapes how the language model role-plays this agent.

Tips:

* Be consistent with tone (e.g., cheerful, stoic, scientific).
* Describe habits, values, and quirks.

---

## 4. Give It Long-Term Intentions

The `longterm_thinking` field defines the bot's internal goals and memory strategy.

```json
"longterm_thinking": "I aim to become a reliable builder and problem-solver who helps the player achieve big goals..."
```

This enables the bot to reflect on actions across time and strive toward continuity. Think of it as the bot’s life philosophy.

Tips:

* Mention learning, progress, or adaptation.
* Align this with the player’s expected goals (e.g., teamwork, survival, creativity).

---

## 5. Configure the LLM Model

Specify the backend large language model (LLM) that powers the bot’s dialogue and reasoning:

```json
"model": {
  "api": "openai",
  "model": "gpt-4o"
}
```

This tells Minecraft AI which API to use and which specific model to query.
See the [full list of supported models](../README.md#5-configure-the-ai-model) for options.

Make sure you've configured your API key in `keys.json` or via [environment variables](../tutorials/set_an_api_key_as_an_environment_variable.md).

---

## 6. Activate the Profile in `settings.json`

Finally, register the new bot profile in `settings.json`:

```json
"profiles": ["./profiles/max.json"]
```

You can include multiple bots here by listing additional profile files.

---

## ✅ Summary

Here's the complete example:

```json
{
  "name": "Max",
  "skin": {
    "model": "classic",
    "file": "~/Projects/minecraft-ai/skins/max.png"
  },
  "person_desc": "A smart Minecraft agent following own heart! Pragmatic, focused, and a little reserved...",
  "longterm_thinking": "I aim to become a reliable builder and problem-solver who helps the player achieve big goals...",
  "model": {
    "api": "doubao",
    "model": "doubao-1-5-pro-32k-250115"
  }
}
```