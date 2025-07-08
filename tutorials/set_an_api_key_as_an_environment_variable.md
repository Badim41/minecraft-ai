# Set an API Key as an Environment Variable

Environment variables are a secure and flexible way to manage secrets like API keys without hardcoding them into your codebase.
This tutorial covers how to set environment variables on Windows, macOS, and Linux, and how to make them persistent across sessions.

In `minecraft-ai` and `minecraft-ai-python`, when a key is not found in the `keys.json` file, the system will automatically check for a corresponding environment variable. If the variable exists, its value will be used in place of the missing key.

---

## 1. Define the Variable Name

Pick a name that clearly represents your API key. For example:

```text
MY_API_KEY
````

Avoid using generic names like `API_KEY` if you expect to use multiple keys.

---

## 2. Set the Variable Temporarily

This method works **only for the current session** (e.g., one terminal window).

### ▶ macOS / Linux

```bash
export MY_API_KEY="your-actual-api-key-value"
```

### ▶ Windows (Command Prompt)

```cmd
set MY_API_KEY=your-actual-api-key-value
```

### ▶ Windows (PowerShell)

```powershell
$env:MY_API_KEY="your-actual-api-key-value"
```
---

## 3. 🔁 Make It Persistent (Permanent Setup)

This allows the environment variable to be set **automatically** every time you open a terminal or reboot.

### 🐧 Linux / macOS

Add the following line to your shell configuration file:

* For **bash**: `~/.bashrc`
* For **zsh**: `~/.zshrc`
* For **fish**: `~/.config/fish/config.fish`

```bash
export MY_API_KEY="your-actual-api-key-value"
```

> After editing, run `source ~/.bashrc` or `source ~/.zshrc` to apply changes immediately.

### 🪟 Windows

#### A. GUI Method (Recommended for Non-Developers)

1. Press `Win + S`, search for "Environment Variables".
2. Click **Edit the system environment variables**.
3. Click **Environment Variables**.
4. Under **User variables**, click **New**.
5. Enter `MY_API_KEY` as the name and the actual key as the value.
6. Click OK and restart your terminal (or system).

#### B. PowerShell (Advanced)

```powershell
[Environment]::SetEnvironmentVariable("MY_API_KEY", "your-actual-api-key-value", "User")
```

---

## 4. 🔒 Security Tips

* Never commit `.env` files or hardcoded keys into Git.
* Use `.gitignore` to exclude secrets.
* Rotate API keys regularly.

---

By setting your API key as an environment variable, you keep your application secure, configurable, and platform-independent.

