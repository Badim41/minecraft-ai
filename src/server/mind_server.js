// server/mind_server.js
import { Server } from 'socket.io';
import { getKey, hasKey } from '../utils/keys.js';
import settings from '../../settings.js';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import cors_proxy from 'cors-anywhere';
import cors from 'cors'; // Добавим CORS поддержку

// Module-level variables
let io;
let server;
const registeredAgents = new Set();
const inGameAgents = {};
const agentManagers = {};
const agentResponses = {}; // Хранилище ответов от агентов

export function createProxyServer(port = 8081, options = []) {
    const defaultOptions = {
        originWhitelist: [],
        requireHeader: [],
        removeHeaders: ['cookie', 'cookie2'],
        redirectSameOrigin: true,
        httpProxyOptions: {
            xfwd: false,
        }
    };

    const server = cors_proxy.createServer({...defaultOptions, ...options});

    server.listen(port, 'localhost', () => {
        console.log(`CORS proxy server started on port ${port}`);
    });

    return server;
}

// Initialize the server
export function createMindServer(port = 8080) {
    const app = express();
    server = http.createServer(app);
    io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    // Middleware
    app.use(cors());
    app.use(express.json());
    app.use(express.static(path.join(path.dirname(fileURLToPath(import.meta.url)), 'public')));

    // HTTP API Endpoints

    // Send command to agent
    app.post('/api/agent/:agentName/command', async (req, res) => {
        const { agentName } = req.params;
        const { command } = req.body;

        if (!inGameAgents[agentName]) {
            return res.status(404).json({ error: `Agent ${agentName} not found or not in game` });
        }

        const requestId = Date.now().toString();
        agentResponses[requestId] = {
            responses: [],
            completed: false,
            startTime: Date.now()
        };

        inGameAgents[agentName].emit('api-command', command, requestId);

        // Wait for response with timeout
        const timeout = 30000; // 30 seconds
        const startTime = Date.now();

        while (!agentResponses[requestId].completed && (Date.now() - startTime) < timeout) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const response = agentResponses[requestId];
        delete agentResponses[requestId];

        if (!response.completed) {
            return res.status(408).json({ error: 'Request timeout' });
        }

        res.json({
            success: true,
            responses: response.responses,
            executionTime: Date.now() - response.startTime
        });
    });

    // Get agent info
    app.get('/api/agent/:agentName/info', (req, res) => {
        const { agentName } = req.params;

        if (!inGameAgents[agentName]) {
            return res.status(404).json({ error: `Agent ${agentName} not found or not in game` });
        }

        const requestId = Date.now().toString();
        inGameAgents[agentName].emit('get-info', requestId);

        // Wait for response
        setTimeout(() => {
            if (agentResponses[requestId]) {
                const info = agentResponses[requestId];
                delete agentResponses[requestId];
                res.json(info);
            } else {
                res.status(408).json({ error: 'Request timeout' });
            }
        }, 1000);
    });

    // List all agents
    app.get('/api/agents', (req, res) => {
        let agents = [];
        registeredAgents.forEach(name => {
            agents.push({
                name,
                in_game: !!inGameAgents[name],
                connected: !!agentManagers[name]
            });
        });
        res.json(agents);
    });

    // Send chat message as agent
    app.post('/api/chat/:agentName', async (req, res) => {
        const { agentName } = req.params;
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        if (!inGameAgents[agentName]) {
            return res.status(404).json({ error: `Agent ${agentName} not found or not in game` });
        }

        const requestId = Date.now().toString();
        agentResponses[requestId] = {
            sent: false,
            startTime: Date.now()
        };

        inGameAgents[agentName].emit('send-chat-message', message, requestId);

        // Wait for confirmation with timeout
        const timeout = 5000; // 5 seconds
        const startTime = Date.now();

        while (!agentResponses[requestId].sent && (Date.now() - startTime) < timeout) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const response = agentResponses[requestId];
        delete agentResponses[requestId];

        if (!response.sent) {
            return res.status(408).json({ error: 'Request timeout' });
        }

        res.json({
            success: true,
            message: message,
            agentName: agentName,
            timestamp: response.startTime
        });
    });

    // Socket.io connection handling (existing code with modifications)
    io.on('connection', (socket) => {
        let curAgentName = null;
        console.log('Client connected');

        agentsUpdate(socket);
        keysUpdate(socket);
        portsUpdate(socket);

        // Handle API command responses
        socket.on('api-response', (requestId, response) => {
            if (agentResponses[requestId]) {
                agentResponses[requestId].responses.push(response);
            }
        });

        socket.on('api-command-complete', (requestId) => {
            if (agentResponses[requestId]) {
                agentResponses[requestId].completed = true;
            }
        });

        socket.on('info-response', (requestId, info) => {
            agentResponses[requestId] = info;
        });

        socket.on('register-agents', (agentNames) => {
            console.log(`Registering agents: ${agentNames}`);
            agentNames.forEach(name => registeredAgents.add(name));
            for (let name of agentNames) {
                agentManagers[name] = socket;
            }
            socket.emit('register-agents-success');
            agentsUpdate();
        });

        socket.on('login-agent', (agentName) => {
            if (curAgentName && curAgentName !== agentName) {
                console.warn(`Agent ${agentName} already logged in as ${curAgentName}`);
                return;
            }
            if (registeredAgents.has(agentName)) {
                curAgentName = agentName;
                inGameAgents[agentName] = socket;
                agentsUpdate();
            } else {
                console.warn(`Agent ${agentName} not registered`);
            }
        });

        socket.on('logout-agent', (agentName) => {
            if (inGameAgents[agentName]) {
                delete inGameAgents[agentName];
                agentsUpdate();
            }
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected');
            if (inGameAgents[curAgentName]) {
                delete inGameAgents[curAgentName];
                agentsUpdate();
            }
        });

        // Existing event handlers...
        socket.on('chat-message', (agentName, json) => {
            if (!inGameAgents[agentName]) {
                console.warn(`Agent ${agentName} tried to send a message but is not logged in`);
                return;
            }
            console.log(`${curAgentName} sending message to ${agentName}: ${json.message}`);
            inGameAgents[agentName].emit('chat-message', curAgentName, json);
        });

        socket.on('restart-agent', (agentName) => {
            console.log(`Restarting agent: ${agentName}`);
            inGameAgents[agentName].emit('restart-agent');
        });

        socket.on('stop-agent', (agentName) => {
            let manager = agentManagers[agentName];
            if (manager) {
                manager.emit('stop-agent', agentName);
            }
            else {
                console.warn(`Stopping unregisterd agent ${agentName}`);
            }
        });

        socket.on('start-agent', (agentName) => {
            let manager = agentManagers[agentName];
            if (manager) {
                manager.emit('start-agent', agentName);
            }
            else {
                console.warn(`Starting unregisterd agent ${agentName}`);
            }
        });

        socket.on('stop-all-agents', () => {
            console.log('Killing all agents');
            stopAllAgents();
        });

        socket.on('shutdown', () => {
            console.log('Shutting down');
            for (let manager of Object.values(agentManagers)) {
                manager.emit('shutdown');
            }
            setTimeout(() => {
                process.exit(0);
            }, 2000);
        });

        socket.on('chat-message-sent', (requestId) => {
            if (agentResponses[requestId]) {
                agentResponses[requestId].sent = true;
            }
        });

		socket.on('send-message', (agentName, message) => {
			if (!inGameAgents[agentName]) {
				console.warn(`Agent ${agentName} not logged in, cannot send message via MindServer.`);
				return
			}
			try {
				console.log(`Sending message to agent ${agentName}: ${message}`);
				inGameAgents[agentName].emit('send-message', agentName, message)
			} catch (error) {
				console.error('Error: ', error);
			}
		});
    });

    server.listen(port, 'localhost', () => {
        console.log(`MindServer running on port ${port}`);
        console.log(`HTTP API available at http://localhost:${port}/api`);
    });

    return server;
}

// Rest of the existing functions remain the same...
function agentsUpdate(socket) {
    if (!socket) {
        socket = io;
    }
    let agents = [];
    registeredAgents.forEach(name => {
        agents.push({name, in_game: !!inGameAgents[name]});
    });
    socket.emit('agents-update', agents);
}

function keysUpdate(socket) {
    if (!socket) {
        socket = io;
    }
    let keys = {
        "BYTEDANCE_APP_ID" : getKey("BYTEDANCE_APP_ID"),
        "BYTEDANCE_APP_TOKEN" : getKey("BYTEDANCE_APP_TOKEN"),
        "OPENAI_API_KEY" : getKey("OPENAI_API_KEY"),
    };
    socket.emit('keys-update', keys);
}

function portsUpdate(socket) {
    if (!socket) {
        socket = io;
    }
    let ports = {
        "proxy" : settings.proxyserver_port,
        "mind" : settings.mindserver_port,
    };
    socket.emit('ports-update', ports);
}

function stopAllAgents() {
    for (const agentName in inGameAgents) {
        let manager = agentManagers[agentName];
        if (manager) {
            manager.emit('stop-agent', agentName);
        }
    }
}

// Optional: export these if you need access to them from other files
export const getIO = () => io;
export const getServer = () => server;
export const getConnectedAgents = () => inGameAgents;
