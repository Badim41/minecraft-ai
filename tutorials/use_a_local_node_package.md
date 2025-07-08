# Use A Local Node Package 

As an example of using a local node package, this guide walks you through manually downloading, extracting, and referencing a local copy of the `mineflayer-pathfinder` package in your `Node.js` project. This is useful for custom patches, offline usage, or version control.

## 1. Download the Specific Package Version

You should obtain the compressed file of `mineflayer-pathfinder` and unpack it into a usable local directory (e.g. a new folder `local_modules`, located at the current directory).

```bash
mkdir local_modules
tar -xzf mineflayer-pathfinder.tar -C local_modules
```
Now your project contains the local pathfinder module at `local_modules/mineflayer-pathfinder`.

Alternatively, you can get the most recent or development version directly from the official repository:

```bash
git clone https://github.com/PrismarineJS/mineflayer-pathfinder.git local_modules/mineflayer-pathfinder
````

## 2. Reference It in `package.json`

Update your `package.json` to use the local path:

```json
{
  "dependencies": {
    "mineflayer-pathfinder": "file:./local_modules/mineflayer-pathfinder"
  }
}
```

This overrides the remote version and uses your local copy instead.

---

## 4. Install the Dependencies

Install using npm:

```bash
npm install
```

This creates a symlink from `node_modules/mineflayer-pathfinder` to your local version.

---

## 5. Verify Usage in Code

Use the module as normal in your project:

```js
const { pathfinder } = require('mineflayer-pathfinder');
bot.loadPlugin(pathfinder);
```

---

## 6. Tips

* Great for debugging or customizing `mineflayer-pathfinder` without forking it publicly.
* Consider excluding the `local_modules` folder from Git with `.gitignore`, unless it's intentional.
* You can also modify the local code directly and reinstall with `npm install` to test changes.

---

This method provides full control over your dependency behavior and allows for rapid iteration or testing with modules like `mineflayer-pathfinder`.
