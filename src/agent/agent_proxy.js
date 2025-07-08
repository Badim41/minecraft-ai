// agent/agent_proxy.js
import { io } from 'socket.io-client';
import convoManager from './conversation.js';
import settings from '../../settings.js';

class AgentServerProxy {
    constructor() {
        if (AgentServerProxy.instance) {
            return AgentServerProxy.instance;
        }

        this.socket = null;
        this.connected = false;
        AgentServerProxy.instance = this;
    }

    connect(agent) {
        if (this.connected) return;

        this.agent = agent;

        this.socket = io(`http://${settings.mindserver_host}:${settings.mindserver_port}`);
        this.connected = true;

        this.socket.on('connect', () => {
            console.log('Connected to MindServer');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from MindServer');
            this.connected = false;
        });

        this.socket.on('chat-message', (agentName, json) => {
            convoManager.receiveFromBot(agentName, json);
        });

        this.socket.on('agents-update', (agents) => {
            convoManager.updateAgents(agents);
        });

        this.socket.on('restart-agent', (agentName) => {
            console.log(`Restarting agent: ${agentName}`);
            this.agent.cleanKill();
        });

        // Обработка API команд
        this.socket.on('api-command', async (command, requestId) => {
            try {
                await this.agent.handleApiCommand(command, requestId);
            } catch (error) {
                console.error('Error handling API command:', error);
                this.socket.emit('api-response', requestId, {
                    type: 'error',
                    message: error.toString(),
                    timestamp: Date.now()
                });
                this.socket.emit('api-command-complete', requestId);
            }
        });

        // Обработка запросов информации
        this.socket.on('get-info', (requestId) => {
            try {
                const info = this.agent.getBotInfo();
                this.socket.emit('info-response', requestId, info);
            } catch (error) {
                console.error('Error getting bot info:', error);
                this.socket.emit('info-response', requestId, {
                    error: error.toString()
                });
            }
        });

        this.socket.on('send-message', (agentName, message) => {
            try {
                this.agent.respondFunc("NO USERNAME", message);
            } catch (error) {
                console.error('Error: ', JSON.stringify(error, Object.getOwnPropertyNames(error)));
            }
        });

        this.socket.on('send-chat-message', async (message, requestId) => {
            try {
                // Отправляем сообщение в чат от лица агента
                await this.agent.openChat(message);

                // Подтверждаем отправку
                this.socket.emit('chat-message-sent', requestId);
            } catch (error) {
                console.error('Error sending chat message:', error);
                // В случае ошибки все равно отправляем подтверждение,
                // чтобы не заблокировать API
                this.socket.emit('chat-message-sent', requestId);
            }
        });
    }

    login() {
        this.socket.emit('login-agent', this.agent.name);
    }

    shutdown() {
        this.socket.emit('shutdown');
    }

    getSocket() {
        return this.socket;
    }
}

// Create and export a singleton instance
export const serverProxy = new AgentServerProxy();

export function sendBotChatToServer(agentName, json) {
    serverProxy.getSocket().emit('chat-message', agentName, json);
}
