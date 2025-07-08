import { Vec3 } from 'vec3';
import * as skills from '../../agent/library/skills.js';
import * as world from '../../agent/library/world.js';
import * as mc from '../../utils/mcdata.js';
import { blockSatisfied, getTypeOfGeneric} from '../../utils/build.js';

export class BuildGoal {
    constructor(agent) {
        this.agent = agent;
    }

    async executeNext(blueprint, built, relax = 0) {
        let position = built.position
        let missing = {};
        let finished = false;
        let failed = false;
        let error = null;

        if (!position) {
            let [min_x, max_x, min_z, max_z] = [0, 0, 0, 0];
            for (let block of blueprint.blocks) {
                if (block[1] !== 0) continue;
                min_x = Math.min(min_x, block[0]);    
                max_x = Math.min(max_x, block[0]);    
                min_z = Math.min(min_z, block[0]);    
                max_z = Math.min(max_z, block[0]);    
            }

            let size = Math.max(max_x - min_x, max_z - min_z);
            position = world.getNearestFreeSpace(this.agent.bot, size, 32);
        }

        if (!position) {
            failed = true; 
            error = `I can't find a free space to build ${goal.name}.`;
        } else {
            let inventory = world.getInventoryCounts(this.agent.bot);
            let satisfied = 0;
            let added = 0;
            for (let block of blueprint.blocks) {
                try {
                    let block_name = block[3];
                    if (block_name === null || block_name === '') continue;
                    const world_pos = new Vec3(position.x + block[0], position.y + block[1], position.z + block[2]);
                    let current_block = this.agent.bot.blockAt(world_pos);

                    if (current_block !== null) {
                        if (blockSatisfied(block_name, current_block, relax)) {
                            satisfied++;
                            continue;
                        } 
                        
                        if (current_block.name !== 'air') {
                            console.log("Need to break block: ", current_block.name)
                            let res = await this.agent.actions.runAction('build:BuildGoal', async () => {
                                await skills.breakBlockAt(this.agent.bot, world_pos.x, world_pos.y, world_pos.z);
                            })
                            if (!res) {
                                failed = true;
                                error = `Interupted in breaking block ${block_name} at ${world_pos.x}, ${world_pos.y}, ${world_pos.z}`;
                                break;
                            }
                        }

                        console.log("Place block: ", block_name)
                        let block_typed = getTypeOfGeneric(this.agent.bot, block_name);
                        if (inventory[block_typed] > 0) {
                            let res = await this.agent.actions.runAction('build:BuildGoal', async () => {
                                await skills.placeBlock(this.agent.bot, block_typed, world_pos.x, world_pos.y, world_pos.z);
                            })
                            if (!res) {
                                failed = true;
                                error = `Interupted when placing ${block_name} at ${world_pos.x}, ${world_pos.y}, ${world_pos.z}`;
                                break;
                            }
                        } else {
                            if (missing[block_typed] === undefined)
                                missing[block_typed] = 0;
                            missing[block_typed]++;
                        }

                        current_block = this.agent.bot.blockAt(world_pos);
                        if (blockSatisfied(block_name, current_block, relax)) {
                            added++;
                        }
                    }
                } catch (e) {
                    console.log(`Error in placing ${block[3]} at ${world_pos.x}, ${world_pos.y}, ${world_pos.z}: `, e);
                    continue
                }
            }
            if (satisfied === blueprint.blocks.length) {
                finished = true;
            } else if (added < 1 && Object.keys(missing).length < 1) {
                failed = true;
                error = `I can't finish building the complete version of ${blueprint.name}.`;
            }
        }
        return {position, finished, missing, failed, error};
    }
}