import { Vec3 } from 'vec3';
import { readdirSync, readFileSync } from 'fs';
import * as skills from '../../agent/library/skills.js';
import * as world from '../../agent/library/world.js';
import * as mc from '../../utils/mcdata.js';

export class PluginInstance {
    constructor(agent) {
        this.agent = agent;
    }

    init() {
    }

    heldBow(bot) {
        let item = bot.heldItem;
        if (!item || !item.name.includes("bow")) {
            let bow = bot.inventory.items().find(item => item.name.includes("bow") && !item.name.includes("crossbow"));
            if (bow) {
                bot.equip(bow, 'hand');
            } else {
                let crossbow = bot.inventory.items().find(item => item.name.includes("crossbow"));
                if (crossbow) {
                    bot.equip(crossbow, 'hand');
                }
            }
            item = bot.heldItem;
        }
        let arrow = true; 
        if (bot.game.gameMode !== 'creative') {
            arrow = bot.inventory.items().find(item => item.name.includes("arrow"));
        }
        return item && item.name.includes("bow") && arrow;
    } 
    
    async shootEntity(bot, entity) {
        let item = bot.heldItem;
        if (item && !item.name.includes("crossbow")) {
            let pos = entity.position;
            if (bot.entity.position.distanceTo(pos) > 12) {
                console.log('moving to mob...')
                await skills.goToPosition(bot, pos.x, pos.y, pos.z, 10);
            }
            // fire bow
            await bot.activateItem();
            await new Promise(resolve => setTimeout(resolve, 800));
            const offset = 1 + Math.floor(bot.entity.position.distanceTo(entity.position) / 10)
            await bot.lookAt(entity.position.offset(0, offset, 0));
            await new Promise(resolve => setTimeout(resolve, 200));
            await bot.deactivateItem();
        } else {
            let pos = entity.position;
            if (bot.entity.position.distanceTo(pos) > 12) {
                console.log('moving to mob...')
                await skills.goToPosition(bot, pos.x, pos.y, pos.z, 10);
            }
            // fire crossbow
            await bot.activateItem();
            await new Promise(resolve => setTimeout(resolve, 1000));
            const offset = 1 + Math.floor(bot.entity.position.distanceTo(entity.position) / 10)
            await bot.lookAt(entity.position.offset(0, offset, 0));
            await new Promise(resolve => setTimeout(resolve, 2000));
            await bot.deactivateItem();
        }
    }

    getPluginActions() {
        return [
            {
                name: '!shoot',
                description: 'Shoot the entity when the the bot has bow (or crossbow) and arrows in the inventory.',
                params: {
                    'type': { type: 'string', description: 'The type of entity to attack.'}, 
                    'kill': { type: 'boolean', description: 'kill the entity or just hit once.'}, 
                },
                perform : async function(agent, type, kill = True) {
                    agent.bot.modes.pause('cowardice');
                    if (type === 'drowned' || type === 'cod' || type === 'salmon' || type === 'tropical_fish' || type === 'squid') {
                        agent.bot.modes.pause('self_preservation'); 
                    }
                    const mob = world.getNearbyEntities(agent.bot, 32).find(entity => entity.name.includes(type));
                    if (mob) {
                        if (agent.bot.usingHeldItem) {
                            await agent.bot.deactivateItem();
                            await new Promise(resolve => setTimeout(resolve, 300));
                        }
                    
                        if (agent.plugin.plugins["ShootWithBowAndArrow"].heldBow(agent.bot)) {
                            console.log("Shoot the entity")
                            if (!kill) {
                                agent.plugin.plugins["ShootWithBowAndArrow"].shootEntity(agent.bot, mob);
                            } else {
                                while (world.getNearbyEntities(agent.bot, 32).includes(mob) && agent.plugin.plugins["ShootWithBowAndArrow"].heldBow(agent.bot)) {
                                    await new Promise(resolve => setTimeout(resolve, 1000));
                                    await agent.plugin.plugins["ShootWithBowAndArrow"].shootEntity(agent.bot, mob);
                                }
                                if (world.getNearbyEntities(agent.bot, 32).includes(mob)) {
                                    agent.bot.chat(`I don't have enough arrows to kill the ${type}!`);
                                } else {
                                    agent.bot.chat(`I killed the ${type}!`);
                                }
                            }
                            return true;
                        } else {
                            agent.bot.chat("I don't have any bow or crossbow!");
                        }
                    } else {
                        agent.bot.chat(`I can't find any ${type} nearby!`);
                    }
                    return false;
                }
            },
        ]
    }
}