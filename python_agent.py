import requests
import json
import time


class MinecraftAgentAPI:
    def __init__(self, base_url="http://localhost:8080"):
        self.base_url = base_url

    def get_agents(self):
        """Получить список всех агентов"""
        response = requests.get(f"{self.base_url}/api/agents")
        return response.json()

    def send_command(self, agent_name, command):
        """Отправить команду агенту"""
        response = requests.post(
            f"{self.base_url}/api/agent/{agent_name}/command",
            json={"command": command},
            timeout=600
        )
        return response.json()

    def send_chat(self, agent_name, message):
        """Отправить команду агенту"""
        response = requests.post(
            f"{self.base_url}/api/chat/{agent_name}",
            json={"message": message}
        )
        return response.json()

    def get_agent_info(self, agent_name):
        """Получить информацию об агенте"""
        response = requests.get(f"{self.base_url}/api/agent/{agent_name}/info")
        return response.json()


# Пример использования
if __name__ == "__main__":
    api = MinecraftAgentAPI()

    # Получить список агентов
    agents = api.get_agents()
    print("Agents:", agents)

    # Отправить команду
    if agents:
        agent_name = agents[0]['name']

        # Получить информацию об агенте
        # info = api.get_agent_info(agent_name)
        # print(f"Agent {agent_name} info:", json.dumps(info, indent=2))

        sent_message = api.send_chat(agent_name, message=input("Введите сообщение для отправки:"))
        print("sent_message", sent_message)

        # Отправить команды
        response = api.send_command(agent_name, input("Введите команду:"))
        print("Command response:", response)

        # Получить обновленную информацию
        time.sleep(2)
        info = api.get_agent_info(agent_name)
        print(f"Updated inventory:", info['inventory'])
