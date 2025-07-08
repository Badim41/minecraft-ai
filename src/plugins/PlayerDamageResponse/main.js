import * as mc from '../../utils/mcdata.js';
import * as world from '../../agent/library/world.js';

/**
 * PlayerDamageResponse Plugin
 *
 * Monitors bot health and provides intelligent damage source identification
 * with contextual system messages for AI decision making.
 *
 * Features:
 * - Real-time health monitoring via 'health' event
 * - Intelligent damage source identification (environmental, mobs, players, etc.)
 * - Cooldown system to prevent message spam
 * - Integration with existing AI context system
 */
export class PluginInstance {
    constructor(agent) {
        this.agent = agent;
        this.bot = agent.bot;

        // Damage tracking state
        this.previousHealth = 20;
        this.lastDamageTime = 0;
        this.lastDamageTaken = 0;

        // Cooldown system (5 seconds between damage messages)
        this.damageMessageCooldown = 5000;
        this.lastDamageMessageTime = 0;

        // Bind methods to preserve context
        this.handleHealthChange = this.handleHealthChange.bind(this);
    }

    /**
     * Initialize the plugin by setting up event listeners
     */
    init() {
        // Wait for bot to be ready before setting up listeners
        if (this.bot.entity) {
            this.setupHealthTracking();
        } else {
            this.bot.once('spawn', () => {
                this.setupHealthTracking();
            });
        }
    }

    /**
     * Set up health tracking event listener
     * @private
     */
    setupHealthTracking() {
        this.previousHealth = this.bot.health || 20;
        this.bot.on('health', this.handleHealthChange);
    }

    /**
     * Handle health change events and process damage
     * @private
     */
    async handleHealthChange() {
        const currentHealth = this.bot.health;

        // Check if damage was taken
        if (currentHealth < this.previousHealth) {
            const damageTaken = this.previousHealth - currentHealth;

            // Update damage tracking
            this.lastDamageTime = Date.now();
            this.lastDamageTaken = damageTaken;

            // Process damage with cooldown
            await this.processDamageEvent(currentHealth, damageTaken);
        }

        this.previousHealth = currentHealth;
    }

    /**
     * Process damage event with cooldown and context messaging
     * @param {number} currentHealth - Current bot health
     * @param {number} damageTaken - Amount of damage taken
     * @private
     */
    async processDamageEvent(currentHealth, damageTaken) {
        const now = Date.now();

        // Apply cooldown to prevent spam
        if (now - this.lastDamageMessageTime < this.damageMessageCooldown) {
            return;
        }

        this.lastDamageMessageTime = now;

        // Identify damage source
        const damageSource = this.identifyDamageSource();

        // Create contextual message for AI
        const healthRounded = Math.round(currentHealth);
        const damageRounded = Math.round(damageTaken);
        const timeStr = this.formatGameTime();

        const message = `[DAMAGE TAKEN | ${timeStr}] You took ${damageRounded} damage from ${damageSource}! Health: ${healthRounded}/20`;

        // Send to AI context via agent's message handling system
        if (this.agent.handleMessage) {
            await this.agent.handleMessage('system', message);
        }
    }

    /**
     * Intelligent damage source identification
     * @returns {string} Human-readable damage source description
     * @private
     */
    identifyDamageSource() {
        if (!this.bot.entity) return "Unknown";

        // Environmental hazards (highest priority) - check blocks directly
        const block = this.bot.blockAt(this.bot.entity.position);
        const blockAbove = this.bot.blockAt(this.bot.entity.position.offset(0, 1, 0));

        // Check for lava
        if (block && (block.name === 'lava' || block.name === 'flowing_lava') ||
            blockAbove && (blockAbove.name === 'lava' || blockAbove.name === 'flowing_lava')) {
            return "Lava";
        }

        // Check for fire
        if (block && block.name === 'fire' ||
            blockAbove && blockAbove.name === 'fire' ||
            this.bot.entity.onFire) {
            return "Fire";
        }

        // Drowning detection
        if (this.bot.entity.isInWater && this.bot.health < 20) {
            if (Date.now() - this.lastDamageTime < 1500) {
                return "Drowning";
            }
        }

        // Find nearby entities within damage range (5 blocks)
        const nearbyEntities = this.getNearbyDamageEntities();

        // Check for hostile mobs
        const hostileMobs = nearbyEntities.filter(entity =>
            mc.isHostile(entity) && entity.isValid
        );

        if (hostileMobs.length > 0) {
            const closestMob = this.getClosestEntity(hostileMobs);
            return `${this.formatEntityName(closestMob.name)} (hostile mob)`;
        }

        // Check for players (PvP)
        const nearbyPlayers = nearbyEntities.filter(entity =>
            entity.type === 'player' && entity.isValid
        );

        if (nearbyPlayers.length > 0) {
            const closestPlayer = this.getClosestEntity(nearbyPlayers);
            return `${closestPlayer.username || 'Unknown Player'} (player)`;
        }

        // Check for starvation
        if (this.bot.food === 0 && this.bot.health < 20) {
            if (Date.now() - this.lastDamageTime < 1500) {
                return "Starvation";
            }
        }

        return "Unknown source";
    }

    /**
     * Get nearby entities that could cause damage
     * @returns {Array} Array of nearby entities
     * @private
     */
    getNearbyDamageEntities() {
        const damageRange = 5;
        const botPosition = this.bot.entity.position;

        return Object.values(this.bot.entities).filter(entity => {
            if (!entity || !entity.position || entity === this.bot.entity) {
                return false;
            }

            // Exclude non-damaging entity types
            if (entity.type === 'object' || entity.type === 'orb' ||
                entity.name === 'item' || entity.name === 'arrow') {
                return false;
            }

            return botPosition.distanceTo(entity.position) <= damageRange;
        });
    }

    /**
     * Get the closest entity from a list
     * @param {Array} entities - Array of entities
     * @returns {Object} Closest entity
     * @private
     */
    getClosestEntity(entities) {
        const botPosition = this.bot.entity.position;

        return entities.reduce((closest, entity) => {
            const distance = botPosition.distanceTo(entity.position);
            const closestDistance = botPosition.distanceTo(closest.position);

            return distance < closestDistance ? entity : closest;
        });
    }

    /**
     * Format entity name for display
     * @param {string} entityName - Raw entity name
     * @returns {string} Formatted entity name
     * @private
     */
    formatEntityName(entityName) {
        return entityName.replace(/_/g, ' ').toLowerCase();
    }

    /**
     * Format current game time for messages
     * @returns {string} Formatted time string
     * @private
     */
    formatGameTime() {
        if (!this.bot.time) return "Unknown";

        const ticks = this.bot.time.timeOfDay;
        const hours = Math.floor(((ticks + 6000) % 24000) / 1000);
        const minutes = Math.floor(((ticks + 6000) % 1000) / 16.67);

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    /**
     * Get plugin actions for command system integration
     * @returns {Array} Array of plugin actions
     */
    getPluginActions() {
        return [
            {
                name: '!damageStatus',
                description: 'Get current damage tracking status and recent damage information.',
                perform: async (agent) => {
                    const timeSinceLastDamage = Date.now() - this.lastDamageTime;
                    const cooldownRemaining = Math.max(0, this.damageMessageCooldown - (Date.now() - this.lastDamageMessageTime));

                    let status = `Health: ${Math.round(this.bot.health)}/20`;

                    if (this.lastDamageTime > 0) {
                        status += `\nLast damage: ${Math.round(this.lastDamageTaken)} (${Math.round(timeSinceLastDamage / 1000)}s ago)`;
                    }

                    if (cooldownRemaining > 0) {
                        status += `\nMessage cooldown: ${Math.round(cooldownRemaining / 1000)}s remaining`;
                    }

                    return status;
                }
            }
        ];
    }
}
