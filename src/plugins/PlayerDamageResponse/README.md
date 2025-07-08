# Minecraft AI Plugin: **PlayerDamageResponse**

The **PlayerDamageResponse** plugin enables your AI bot to intelligently detect and respond to damage events. It monitors the bot's health in real-time and provides contextual information about damage sources to help the AI make informed decisions.

---

## 🔧 How to Use

To activate the **PlayerDamageResponse** plugin:

1. Add `"PlayerDamageResponse"` to the `plugins` array in `settings.js`:

```javascript
"plugins": ["PlayerDamageResponse", "Dance", "BuildWithBlueprint"]
```

2. Restart the Minecraft AI agent

The plugin will automatically start monitoring damage events once enabled.

---

## ⚡ Features

- **Real-time damage detection** via health monitoring
- **Intelligent source identification** (lava, mobs, players, starvation, etc.)
- **Contextual AI messages** with damage details
- **Spam prevention** with 5-second cooldown system
- **Debug command** for status checking

---

## 📋 Commands

### `!damageStatus`
Get current damage tracking information.

**Returns:**
- Current health level
- Last damage amount and timing
- Cooldown status (if active)

**Example output:**
```
Health: 15/20
Last damage: 3 (12s ago)
Message cooldown: 2s remaining
```

---

## 📨 Message Format

When the bot takes damage, the AI receives contextual messages like:

```
[DAMAGE TAKEN | 14:32] You took 4 damage from zombie (hostile mob)! Health: 16/20
```

**Damage sources detected:**
- Environmental: Lava, Fire, Drowning
- Entities: Hostile mobs, Players
- Status: Starvation
- Fallback: Unknown source
