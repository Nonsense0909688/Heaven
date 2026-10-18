# Windows setup

Heaven works great on Windows, but there are a few Windows-specific wrinkles. Here's
how to get past all of them.

---

## Installing the `heaven` command

From the project folder:

```powershell
npm link
```

Then **open a new terminal** (in VS Code, fully restart it) and try:

```powershell
heaven help
```

### "heaven is not recognized…"

That usually means the folder npm puts commands in isn't on your PATH. Check:

```powershell
npm prefix -g                       # e.g. C:\Users\You\AppData\Roaming\npm
dir (npm prefix -g)                 # you should see heaven.cmd and heaven.ps1
where.exe heaven
```

If `heaven.cmd` is there but `where.exe` can't find it, add the folder to PATH:

```powershell
$p = npm prefix -g
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";$p", "User")
```

Close **all** terminals (and VS Code), reopen, and try again. In the meantime you can
run it by full path:

```powershell
& "$(npm prefix -g)\heaven.cmd" help
```

### "running scripts is disabled on this system"

PowerShell is refusing to run `heaven.ps1`. Allow locally-created scripts for your user:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### Linking from a different drive

If your project is on another drive (say `Z:\`) and `npm link` seems to do nothing,
check with `npm ls -g --link=true`. If `heaven` isn't listed, try:

```powershell
npm install -g .
```

---

## Skip linking entirely

You never *need* `npm link`. Two alternatives:

**Run it directly:**

```powershell
node Z:\Projects\heaven\bin\heaven.js get https://example.com
```

**Make a PowerShell shortcut.** Run `notepad $PROFILE` and add:

```powershell
function heaven { node Z:\Projects\heaven\bin\heaven.js @args }
function hv     { node Z:\Projects\heaven\bin\heaven.js @args }
```

Save, then open a new terminal. (Change the path to wherever your project lives.)

---

## Quoting in PowerShell

PowerShell treats quotes and `$` differently from bash, and it's the #1 source of
confusing errors. The rules of thumb:

**JSON bodies: use a file.** It sidesteps quoting completely.

```powershell
# body.json contains {"name":"Anish"}
heaven post /users --json @body.json
```

**Placeholders with `$env`: use single quotes**, so PowerShell doesn't expand them:

```powershell
heaven env set dev -v token='{{$env.MY_TOKEN}}'     # ✅
heaven env set dev -v token="{{$env.MY_TOKEN}}"     # ❌ PowerShell eats $env
```

**Setting a shell variable for `{{$env.X}}` to read:**

```powershell
$env:MY_TOKEN = "abc123"          # lasts for this terminal session
```

**Brackets in `--ignore` or paths:** quote them.

```powershell
heaven compare get-user --env dev --env prod --ignore 'items[*].id'
```

**Line continuation** in PowerShell is a backtick `` ` `` (not `\`):

```powershell
heaven get /users `
  -q page=2 `
  --expect-status 200
```

---

## Where Heaven stores data on Windows

By default in `C:\Users\<you>\.heaven`. To put it elsewhere:

```powershell
[Environment]::SetEnvironmentVariable("HEAVEN_HOME", "Z:\data\heaven", "User")
```

Or run `heaven init` in a project to keep data alongside the code. Note: Windows
doesn't enforce the owner-only file permissions Heaven requests on Linux and macOS,
so another reason to keep secrets in `{{$env.NAME}}` references.

---

## Colours look broken?

Older consoles may show raw escape codes like `←[32m`. Use Windows Terminal or the VS
Code terminal, or turn colour off:

```powershell
$env:NO_COLOR = "1"
```
