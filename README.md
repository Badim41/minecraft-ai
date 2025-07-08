# minecraft-ai (Fork)

This is a fork of the original [minecraft-ai](https://github.com/aeromechanic000/minecraft-ai) project.

## Рекомендации
Я рекомендую использовать сервер с версией 1.20.4 Fabric (Java: 21)

Если вы записываете видео, то в качестве камеры рекомендую использовать отдельный майнкрафт-клиент с модом [SpectatorPlus](https://modrinth.com/plugin/spectatorplus). Он позволяет видеть хотбар, хп, руки.

Это явно того стоит. Для сравнения скриншоты:

#### Плагин BrowserView (prismarine-viewer):

(от лица агента)

![Prismarine Viewer](https://raw.githubusercontent.com/Badim41/minecraft-ai/refs/heads/main/screenshots/prismarine-viewer.png)

#### Клиент + Мод SpectatorPlus:

(от лица агента)

![SpectatorPlus](https://raw.githubusercontent.com/Badim41/minecraft-ai/refs/heads/main/screenshots/spectatorplus.png)

Также для удобства [Skin Restorer](https://modrinth.com/mod/skinrestorer/versions) и [Fabric API](https://modrinth.com/mod/fabric-api/version/0.91.2+1.20.4)

## 🛠️ Изменения
- Добавлен REST-api для взаимодействия с агентами
- Перевод некоторых запросов на **русский**

- Убран ввод команд через чат
- Убран автоперевод запросов на английский


## Руководство по API

Пример python: [python_agent.py](https://github.com/Badim41/minecraft-ai/blob/main/python_agent.py)

### API позволяет:
* Отправлять команды агентам
* Получать информацию об агентах
* Отправлять сообщения в чат от имени агента
* Получать список агентов 

### **GET** `/api/agents`

**Response:**

```json
[
  {
    "name": "Agent1",
    "in_game": true,
    "connected": true
  },
  ...
]
```

---

### **GET** `/api/agent/:agentName/info`

**Response:**

```json
{
  "position": {...},
  "health": 20,
  "inventory": [...],
  ...
}
```

---

### **POST** `/api/chat/:agentName`

**Payload:**

```json
{
  "message": "Привет, агент!"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Привет, агент!",
  "agentName": "Agent1",
  "timestamp": 1720451234567
}
```

---

### **POST** `/api/agent/:agentName/command`

**Payload:**

```json
{
  "command": "go to x:10 y:64 z:5"
}
```

**Response:**

```json
{
  "success": true,
  "responses": ["Moving...", "Arrived at destination"],
  "executionTime": 3021
}
```

## 🧾 Citation
RU:
Если вы используете этот проект или его ответвление в научной работе, пожалуйста, укажите исходный репозиторий:

EN:
If you use this project or its fork in academic work, please cite the original repository:

```
@misc{minecraft_ai_2025,
    author = {Minecraft AI},
    title = {Minecraft AI: Toward Embodied Turing Test Through AI Characters},
    year = {2025},
    url={https://github.com/aeromechanic000/minecraft-ai-whitepaper}
}
```