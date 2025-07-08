import { Vec3 } from 'vec3';
import { readdirSync, readFileSync } from 'fs';
import { join, relative, isAbsolute } from 'path';
import * as skills from '../../agent/library/skills.js';
import * as world from '../../agent/library/world.js';
import * as mc from '../../utils/mcdata.js';
import { itemSatisfied} from '../../utils/build.js';
import { splitContentAndJSON } from '../../utils/generation.js';
import { ItemGoal } from './item_goal.js';
import { BuildGoal } from './build_goal.js';

export class PluginInstance {
    constructor(agent) {
        this.agent = agent;
        this.goals = [];
        this.blueprint = null;
        this.built = {};
        this.item_goal = new ItemGoal(agent);
        this.build_goal = new BuildGoal(agent);
        this.blueprints = {};
    }

    getPluginActions() {
        return [
            {
                name: '!build',
                description: this.replaceStrings('Build a structure when there is a proper blueprint for the refenrece. This is preferred if there is a blueprint that is similar to what you want to build, and the name of reference blueprint should be selected from the availabel blueprints. \n$BUILD_BLUEPRINTS'),
                params: {
                    'blueprint': { type: 'string', description: 'name of the reference blueprint.' },
                    'idea': { type: 'string', description: 'a concise description on how to modify a reference blueprint so that buildings sharing the same blueprint can each have distinct, recognizable features.' },
                },
                perform: async function (agent, blueprint, idea) {
                    await agent.plugin.plugins["BuildWithBlueprint"].buildWithIdea(blueprint, idea);
                }
            },
            {
                name: '!endBuild',
                description: 'Call when you are satisfied with what you built. It will stop the action if you are building an architecture with a reference blueprint. ',
                perform: async function () {
                    this.stop();
                    return 'Building stopped.';
                }
            },
        ]
    }

    getBuiltPositions() {
        let positions = [];
        for (let name in this.built) {
            let position = this.built[name].position;
            let sizex = this.blueprints[name].blocks[0][0].length;
            let sizez = this.blueprints[name].blocks[0].length;
            let sizey = this.blueprints[name].blocks.length;
            for (let y = 0; y < sizey; y++) {
                for (let z = 0; z < sizez; z++) {
                    for (let x = 0; x < sizex; x++) {
                        positions.push({x: position.x + x, y: position.y + y, z: position.z + z});
                    }
                }
            }
        }
        return positions;
    }

    init() {
        try {
            const dir = 'src/plugins/BuildWithBlueprint/blueprints/';
            for (let file of readdirSync(dir)) {
                if (file.endsWith('.json') && !file.startsWith('.')) {
                    this.blueprints[file.slice(0, -5)] = JSON.parse(readFileSync(join(dir, file), 'utf8'));
                }
            }
        } catch (e) {
            console.log('Error reading blueprint file');
        }

        this.agent.bot.on('idle', async () => {
            if (!this.agent.isIdle() || this.goals.length < 1) return;
            // Wait a while for inputs before acting independently
            await new Promise((resolve) => setTimeout(resolve, 5000));
            // Persue goal
            if (!this.agent.actions.resume_func) {
                await this.executeNext();
                this.agent.history.save();
            }
        });
    }

    stop() {
        this.goals = [];
        this.blueprint = null;
        this.built = {};
    }

    async setGoal(name, quantity=1, idea="", blueprint=null) {
        this.stop();
        if (name) {
            let goal = {name: name, quantity: quantity};
            if (blueprint)
                this.blueprint = blueprint;
            else if (this.blueprints[name] !== undefined)
                this.blueprint = this.blueprints[name];
            
            this.blueprint.blocks.sort((a, b) => {
                if (a[1] === b[1]) {
                    if (a[0] === b[0]) {
                        return a[2] - b[2];
                    } else {
                        return a[0] - b[0];
                    }
                }
                return a[1] - b[1];
            });
            this.goals.push(goal);
            console.log('Set new building goal: ', name, ' x', quantity, ' with blueprint: ', this.blueprint);
            this.agent.bot.emit('idle');
        }
    }

    async executeNext() {
        if (!this.agent.isIdle() || this.goals.length < 1) return;

        await this.agent.actions.runAction('build:moveAway', async () => {
            await skills.moveAway(this.agent.bot, 2);
        });
        
        let door_pos = this.getCurrentBuildingDoor();
        if (door_pos) {
            await this.agent.actions.runAction('build:exitBuilding', async () => {
                await skills.useDoor(this.agent.bot, door_pos);
                await skills.moveAway(this.agent.bot, 2); 
            });
        }

        // Work towards goals
        await this.executeGoal();

        if (this.agent.isIdle()) this.agent.bot.emit('idle');
    }
    
    inBuilding() {
        if (!this.blueprint || this.built.position === undefined) return false;
        let bot_pos = this.agent.bot.entity.position;
        let pos = this.built.position;
        let sizex = this.blueprint.blocks[0][0].length;
        let sizez = this.blueprint.blocks[0].length;
        let sizey = this.blueprint.blocks.length;
        if (bot_pos.x >= pos.x && bot_pos.x < pos.x + sizex &&
            bot_pos.y >= pos.y && bot_pos.y < pos.y + sizey &&
            bot_pos.z >= pos.z && bot_pos.z < pos.z + sizez) {
            return true;
        }
        return false;
    }

    getCurrentBuildingDoor() {
        if (!this.inBuilding) return null; 
        try {
            let door_x = null;
            let door_z = null;
            let door_y = null;
            for (let y = 0; y < this.blueprint.blocks.length; y++) {
                for (let z = 0; z < this.blueprint.blocks[y].length; z++) {
                    for (let x = 0; x < this.blueprint.blocks[y][z].length; x++) {
                        if (this.blueprint.blocks[y][z][x] !== null &&
                            this.blueprint.blocks[y][z][x].includes('door')) {
                            door_x = x;
                            door_z = z;
                            door_y = y;
                            break;
                        }
                    }
                    if (door_x !== null) break;
                }
                if (door_x !== null) break;
            }
            if (door_x === null) return null;

            return {
                x: this.built.position.x + door_x,
                y: this.built.position.y + door_y,
                z: this.built.position.z + door_z
            };
        } catch (e) {
            return null;
        }
    }

    async executeGoal() {
        console.log("Executing goals: ", this.goals);
        if (this.goals.length < 1) {
            this.stop();
            return;
        }
        let goal = this.goals[0];
        try {
            if (!this.blueprints[goal.name]) {
                console.log(`Item goal: ${goal.name} x ${goal.quantity}.`);
                if (this.agent.bot.game.gameMode === "creative") {
                    this.agent.bot.chat(`/give ${this.agent.name} ${goal.name} ${goal.quantity}`)
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                } 
                if (!itemSatisfied(this.agent.bot, goal.name, goal.quantity)) {
                    let res = await this.item_goal.executeNext(goal.name, goal.quantity);
                    if (!res) {
                        this.agent.bot.chat(`I can't build ${this.goals[-1].name}, as stuck when get ${goal.name} x ${goal.quantity}.`);
                        this.stop();
                    }
                } 
                if (itemSatisfied(this.agent.bot, goal.name, goal.quantity) && this.goals.length > 0) {
                    this.goals.shift();
                    console.log("Left goals (item goal shifted): ", this.goals);
                }
            } else {
                console.log(`Build goal: ${goal.name} x ${goal.quantity}.`);
                let res = await this.build_goal.executeNext(this.blueprint, this.built)
                for (let block_name in res.missing) {
                    this.goals.unshift({
                        name: block_name,
                        quantity: res.missing[block_name]
                    })
                }

                if (res.failed) {
                    this.agent.bot.chat(res.error);
                    this.stop();
                } else {
                    this.built.position = res.position;
                }

                if (res.finished && this.goals.length > 0) {
                    this.goals.shift();
                    console.log("Left goals (build goal shifted): ", this.goals);
                } 
            }
        } catch (e) {
            console.log("Error in executing building goal: ", e);
            this.agent.bot.chat(`I can't build ${goal.name} right now.`);
            this.stop();
        }

        console.log("Left goals: ", this.goals);
        if (this.goals.length > 0) {
            this.agent.bot.emit("idle");
        } else {
            this.agent.bot.chat(`I finished the building.`);
            this.stop();
        }
    }
    async buildWithIdea(name, idea) {
        if (this.blueprints[name] === undefined) {
            console.log(`Can't find reference blueprint: ${name}.`);
            return 
        }
        console.log("Building with idea: ", name, idea)
        let blueprint = await this.promptBuilding(name, idea);
        if (blueprint && blueprint.blocks && blueprint.blocks.length > 0) {
            console.log(`Generated blueprint to build with:\n${JSON.stringify(blueprint)}`);
            this.setGoal(name, 1, idea, blueprint);
        } else {
            this.agent.bot.chat(`I got an invalid blueprint for ${name}: ${blueprint}`);
            console.log('Error in generating blueprint for building.');
        }
    }

    async promptBuilding(name, idea) {
        await this.agent.prompter.checkCooldown();
        let blueprint = this.blueprints[name];
        let items = this.getItemsForBuilding(blueprint);
        let gen_blueprint = null;
        let prompt = this.agent.prompter.profile.build; 
        if (!prompt || prompt.trim().length < 1) {
            prompt = "You are a playful Minecraft bot named $NAME who is good at making building blueprints based on the following reference and a design idea: \n$BUILD_BLUEPRINT\n$BUILD_IDEA\n\nThe result should be formatted in **JSON** dictionary and enclosed in **triple backticks (` ``` ` )**  without labels like \"json\", \"css\", or \"data\".\n- **Do not** generate redundant content other than the result in JSON format.\n- **Do not** use triple backticks anywhere else in your answer.\n- The JSON must include key \"blocks\" whose value is a list of blocks, and for each block, it is also a JSON list including the x, y, z coordinates and item names. \n$BUILD_ITEMS\n\n\nFollowing is an example of the output: \n```{\n \"blocks\" : [\n\t[0, 0, 0, \"planks\"],\n\t[0, 0, 1, \"planks\"],\n\t[1, 0, 1, \"planks\"],\n\t[1, 0, 0, \"planks\"]\n]\n}\n```";
        }
        if (prompt && prompt.trim().length > 0) {
            prompt = this.replaceStrings(prompt, name, idea);
            prompt = await this.agent.prompter.replaceStrings(prompt);
            let generation = await this.agent.prompter.chat_model.sendRequest([], prompt);
            if (generation) {
                console.log(`Response to blueprint generation: ""${generation}""`);
                let blocks = this.extractGeneratedBuildingBlocks(generation);
                if (blocks.length > 0) {
                    gen_blueprint = {name : blueprint.name, blocks : []};
                    for (let block of blocks) {
                        if (Array.isArray(block) && block.length > 3 && block.slice(0, 3).every(Number.isInteger) && items.includes(block[3])) {
                            gen_blueprint.blocks.push(block);
                        }
                    }
                    if (gen_blueprint.blocks.length < 1) {
                        this.agent.bot.chat(`I can't generate the blueprint with valid blocks.`);
                        console.log("No invalid blocks found in the generated blueprint.");
                    } 
                } else {
                    this.agent.bot.chat(`The generated blueprint contains none of blocks.`);
                    console.log("No blocks extracted from the generation.");
                }
            }
        }
        return gen_blueprint;
    }

    replaceStrings(prompt, name = '', idea = '') {
        let blueprint = this.blueprints[name];
        if (blueprint) {
            if (prompt.includes('$BUILD_BLUEPRINT')) {
                prompt = prompt.replaceAll("$BUILD_BLUEPRINT", "\n## Reference Blueprint:\n" + JSON.stringify(blueprint.blocks));
            }
        }
    
        if (prompt.includes('$BUILD_ITEMS')) {
            let items = this.getItemsForBuilding(blueprint);
            prompt = prompt.replaceAll("$BUILD_ITEMS", "## Item Names:\n" + items.join(", "));
        }

        if (prompt.includes('$BUILD_IDEA')) {
            prompt = prompt.replaceAll("$BUILD_IDEA", "## Design Idea:\n" + idea);
        }

        if (prompt.includes('$BUILD_BLUEPRINTS')) {
            if (this.blueprints) {
                let blueprints = '';
                for (let blueprint in this.blueprints) {
                    blueprints += blueprint + ', ';
                }
                if (blueprints.trim().length > 0)
                    prompt = prompt.replaceAll('$BUILD_BLUEPRINTS', "## Blueprints for Reference:\n" + blueprints.slice(0, -2));
            }
        }
        return prompt
    }
    
    extractGeneratedBuildingBlocks(text) {
        let [content, data] = splitContentAndJSON(text);
        let blocks = [];
        if (data.blocks && Array.isArray(data.blocks)) {
            blocks = data.blocks;
        }
        return blocks
    }

    getItemsForBuilding(blueprint = null) {
        const buildingBlocks = [
            "stone", "cobblestone", "stone_bricks", "oak_planks", "spruce_planks",
            "birch_planks", "dark_oak_planks", "sandstone",
            "red_sandstone", "bricks", "deepslate_bricks", "quartz_block",
            "snow_block", "gray_concrete", "white_concrete", "obsidian",
        ]
        const buildingItems = [
            "torch", "ladder", "oak_door", "spruce_door", "glass",
            "glass_pane", "oak_fence", "spruce_fence", "oak_stairs", "stone_stairs",
            "cobblestone_stairs", "sandstone_stairs", "brick_stairs", "quartz_stairs",
            "oak_slab", "stone_slab", "brick_slab", "quartz_slab",
        ]
        return buildingBlocks.concat(buildingItems) 
    }

}