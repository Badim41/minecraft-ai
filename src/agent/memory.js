import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import settings from '../../settings.js';


export class Memory {
    constructor(agent) {
        this.agent = agent;
        this.summary = '';
        this.bank = {}; 
    }

    async get() {
        let memory_info = this.summary;
        let bank_info = "";
        for (const key in this.bank) {
            bank_info += `${key}:\n${this.bank[key].value}\n`;
        }
        if (bank_info.trim().length > 0) {
            memory_info += `\n\n## Memory Bank (the remembered facts and information):\n${bank_info}`;
        }
        return memory_info;
    }

    set(content) {
        this.summary = content.summary || '';
        this.bank = content.bank || {};
    }

    async update(data) {
        this.summary = await this.agent.prompter.promptMemSaving(data.history);

        if (this.summary.length > 500) {
            this.summary = this.summary.slice(0, 500);
            this.summary += '...(Memory summary truncated to 500 chars. Compress it more next time)';
        }

        console.log("Memory summary updated to: ", this.summary);
    }

    clear() {
        this.summary = '';
        this.bank = {};
    }

    remember(key, value) {
		this.bank[key] = {"value" : value, "timestamp": new Date().toISOString()};
        if (Object.keys(this.bank).length > settings.memory_bank_size) {
            let oldest_key = Object.keys(this.bank)[0];
            for (const k in this.bank) {
                if (this.bank[k].timestamp < this.bank[oldest_key].timestamp) {
                    oldest_key = k;
                }
            }
            if (oldest_key) {
                delete this.bank[oldest_key];
            }
        }
	}
}