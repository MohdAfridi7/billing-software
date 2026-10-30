// Step-by-step install and update guides, written for people who have never
// unzipped a file or opened a Terminal (asked for by the maintainer: "so many
// people don't know how to use things or use the terminal"). Every step says
// what to click and what you should see next.
import { SITE } from '../site.mjs';

const ui = (s) => `<span class="ui">${s}</span>`;
const img = (f) => `assets/img/${f}`;
const key = (...k) => k.map((x) => `<kbd>${x}</kbd>`).join(' + ');

const which = `
<div class="note tip"><strong>Which guide is mine?</strong>
<p><b>Windows</b> (most PCs and laptops): <a href="install.html">Install on Windows</a>.
<b>Mac</b> (Apple logo top left): <a href="install-mac.html">Install on a Mac</a>.
<b>Linux or a NAS</b>: <a href="install-linux.html">Install on Linux or a NAS</a>.
Already installed? <a href="update.html">Updating</a>.</p></div>`;

export default [
// =============================================================================
{
  slug: 'install',
  title: 'Install on Windows, step by step',
  nav: 'Install on Windows',
  lead: 'Download one file, unzip it, click Install. About 5 minutes, no technical knowledge needed, and no administrator password. Every step below says what to click and what you should see.',
  body: `
${which}

<section id="before">
<h2>Before you start</h2>
<ul>
  <li><strong>Windows 10 or Windows 11.</strong> To check: press ${key('Windows', 'R')}, type <code>winver</code>, press ${key('Enter')}.</li>
  <li><strong>Internet</strong> for the first install only (it downloads about 60 MB). After that the app works offline.</li>
  <li><strong>About 400 MB of free space.</strong></li>
</ul>
</section>

<section id="download">
<h2>Step 1: Download</h2>
<ol class="steps">
  <li><strong>Click this button</strong><a class="download" href="${SITE.download}">Download Free GST Billing</a></li>
  <li><strong>Wait for the download to finish</strong>Your browser shows it at the top right (Chrome and Edge) or bottom left. The file is called <code>Free-GST-Billing.zip</code>.</li>
  <li><strong>Open your Downloads folder</strong>Click the folder icon next to the download, or open <b>File Explorer</b> (the yellow folder on the taskbar) and click <b>Downloads</b> on the left.</li>
</ol>
<div class="note warn"><strong>Use this button, not GitHub's green Code button</strong>
<p>The green ${ui('Code')} button on GitHub gives you the source code, not the app. It will not install.</p></div>
</section>

<section id="extract-first">
<h2>Step 2: Unzip (extract) it</h2>
<p>A ZIP is a packed folder. Windows can open it, but the app cannot run from inside it, so it has to be unpacked first.</p>
<ol class="steps">
  <li><strong>Right-click the ZIP</strong>Right-click <code>Free-GST-Billing.zip</code> and choose ${ui('Extract All\u2026')}. (On Windows 11 it may be under ${ui('Show more options')}.)</li>
  <li><strong>Choose where</strong>Click ${ui('Browse\u2026')} and pick <b>Documents</b>, or a drive like <code>D:\\</code>. Not <b>Downloads</b>: things there get deleted when people tidy up. Do not choose <code>C:\\Program Files</code>.</li>
  <li><strong>Click Extract</strong>A new folder called <b>Free-GST-Billing</b> opens. Inside you see <b>Free GST Billing - WINDOWS</b>, <b>READ ME FIRST</b>, and launchers for Mac and Linux.</li>
</ol>
<p>If you double-click the launcher while still looking inside the ZIP, it says <i>Please extract the ZIP first</i>. Close it and do this step.</p>
<figure class="narrow"><img src="${img('launcher-zip.png')}" alt="The launcher explaining that the ZIP needs to be extracted first"></figure>
</section>

<section id="launch">
<h2>Step 3: Open the launcher and click Install</h2>
<ol class="steps">
  <li><strong>Double-click "Free GST Billing - WINDOWS"</strong>In the Free-GST-Billing folder.</li>
  <li><strong>If Windows warns you</strong>See <a href="#windows-protected">"Windows protected your PC"</a> just below: click ${ui('More info')}, then ${ui('Run anyway')}. If it asks <i>Do you want to run this file?</i>, click ${ui('Run')} or ${ui('Open')}.</li>
  <li><strong>Click Install</strong>A small window opens with one big button. Click ${ui('Install')}. There is nothing to fill in.</li>
  <li><strong>Leave the black window alone</strong>A black window appears and does the work: it may get Node.js (the engine the app runs on, about 30 MB, kept inside the app folder) and then the app's parts. This takes 1 to 3 minutes. Don't close it; it closes by itself.</li>
  <li><strong>The app opens in your browser</strong>at <code>http://localhost:47371</code>. A short welcome asks for your business details. See <a href="first-run.html">The first-run setup</a>.</li>
</ol>
<figure class="pair">
  <img src="${img('launcher-install.png')}" alt="The launcher before install, showing one Install button">
  <img src="${img('launcher-ready.png')}" alt="The launcher after install, showing one Open App button">
  <figcaption>Before install the launcher shows one button. Afterwards it shows ${ui('Open App')}, and the rest is under ${ui('More options')}.</figcaption>
</figure>
<div class="note tip"><strong>If the black window shows a message in red</strong>
<p>It says what is wrong and what to do (no internet, disk full, folder in the wrong place, antivirus). Do that, then click ${ui('Install')} again; it carries on where it stopped. The full list is in <a href="troubleshooting.html#install-failed">The install stopped with an error</a>.</p></div>
</section>

<section id="windows-protected">
<h2>"Windows protected your PC"</h2>
<p>This blue box appears the first time for any program that is not signed with a paid certificate (a few hundred dollars a year, which would make a free app not free). It does not mean anything is wrong.</p>
<ol>
  <li>Click the small link ${ui('More info')}.</li>
  <li>Click the button ${ui('Run anyway')}.</li>
</ol>
<p>If the file will not open at all: right-click <b>Free GST Billing - WINDOWS</b>, choose ${ui('Properties')}, tick ${ui('Unblock')} at the bottom, click ${ui('OK')}, and double-click it again.</p>
<p>If your antivirus deletes a file during the install, add the Free-GST-Billing folder to its exclusions (often under <i>Exclusions</i> or <i>Allowed apps</i>) and click ${ui('Install')} again.</p>
</section>

<section id="every-day">
<h2>Every day after that</h2>
<ol class="steps">
  <li><strong>Double-click "Free GST Billing" on your Desktop</strong>The install put this shortcut there (and in the Start menu).</li>
  <li><strong>Click Open App</strong>The app opens in your browser. You can close the launcher window.</li>
</ol>
<p>To stop the app: open the launcher, click ${ui('More options')}, then ${ui('Stop the app')}. Restarting the computer also stops it.</p>
<p>Your data is in the <code>_system\\data</code> folder inside Free-GST-Billing. Back it up with ${ui('More options')} → ${ui('Back up my data')}; see <a href="backup.html">Backups</a>.</p>
</section>

<section id="what-install-does">
<h2>What the installer does</h2>
<ul>
  <li><strong>Checks your PC</strong>: Windows 10 or 11, enough free space, a folder it can write to, and the internet.</li>
  <li><strong>Sets up Node.js inside the app folder</strong> if the PC does not have a recent one. It is downloaded once from nodejs.org into <code>_system\\node</code>. Nothing is installed into Windows and no administrator password is needed. If that download fails, it asks before using Windows' own installer (winget), and otherwise opens the download page.</li>
  <li><strong>Downloads the app's parts</strong> from the internet.</li>
  <li><strong>Adds a Free GST Billing shortcut</strong> to your Desktop and Start menu.</li>
  <li><strong>Opens the app</strong> in your browser.</li>
</ul>
</section>

<section id="one-command">
<h2>Install with one command (for IT people)</h2>
<p>Open PowerShell and paste:</p>
<pre><code>irm https://raw.githubusercontent.com/IamRamgarhia/Free-GST-Billing-Software/main/install.ps1 | iex</code></pre>
<p>It installs to <code>%LOCALAPPDATA%\\Programs\\Free GST Billing</code>; set <code>$env:FREEGSTBILL_DIR = 'D:\\Apps\\Free GST Billing'</code> first to choose another folder. It stops if the app is already installed there with data in it.</p>
</section>

<section id="uninstall">
<h2>Removing the app</h2>
<p>Nothing is installed into Windows, so removing it is deleting it:</p>
<ol>
  <li><strong>Back up your data first</strong> if you may want it again. See <a href="backup.html#export-import">Export everything to one file</a>.</li>
  <li>In the launcher, ${ui('More options')} → ${ui('Stop the app')}.</li>
  <li>Delete the Free-GST-Billing folder and the <b>Free GST Billing</b> shortcuts on the Desktop and in the Start menu.</li>
</ol>
</section>
`,
},

// =============================================================================
{
  slug: 'install-mac',
  title: 'Install on a Mac, step by step',
  nav: 'Install on a Mac',
  lead: 'Three parts: install Node.js (a normal Mac installer), download the app, open it. About 10 minutes. You type only your Mac password and press Return once; every step says what you will see.',
  body: `
${which}

<section id="before">
<h2>Before you start</h2>
<ul>
  <li><strong>macOS 11 Big Sur or newer.</strong> To check: click the Apple menu (the apple logo at the top left), then ${ui('About This Mac')}.</li>
  <li>Your <strong>Mac password</strong> (the one you use to log in), for the Node.js installer.</li>
  <li><strong>Internet</strong> for the first install. After that the app works offline.</li>
</ul>
</section>

<section id="node">
<h2>Part 1: Install Node.js (once)</h2>
<p>Node.js is free software the app runs on. It installs like any other Mac app.</p>
<ol class="steps">
  <li><strong>Go to nodejs.org</strong>Open <a href="https://nodejs.org/en/download">nodejs.org/en/download</a> in Safari or Chrome.</li>
  <li><strong>Download the macOS Installer</strong>Click the button for the <b>macOS Installer (.pkg)</b> of the <b>LTS</b> version. (LTS means the stable version.)</li>
  <li><strong>Open the downloaded file</strong>Click the download arrow in your browser, or open <b>Finder</b> → <b>Downloads</b>, and double-click the file whose name starts with <code>node-v</code> and ends in <code>.pkg</code>.</li>
  <li><strong>Click through the installer</strong>${ui('Continue')}, ${ui('Continue')}, ${ui('Agree')}, ${ui('Install')}. Type your Mac password when asked and click ${ui('Install Software')}. Then ${ui('Close')}. (If it asks to move the installer to the Bin, that is fine.)</li>
</ol>
</section>

<section id="download">
<h2>Part 2: Download and unzip the app</h2>
<ol class="steps">
  <li><strong>Download</strong><a class="download" href="${SITE.download}">Download Free GST Billing</a></li>
  <li><strong>Find it in Downloads</strong>Open <b>Finder</b> (the blue face in the Dock) and click <b>Downloads</b> on the left. <b>Safari</b> usually unzips it for you, so you see a folder called <b>Free-GST-Billing</b>. If you see <code>Free-GST-Billing.zip</code> instead, double-click it to unzip.</li>
  <li><strong>Move the folder to Documents</strong>Drag the <b>Free-GST-Billing</b> folder onto <b>Documents</b> on the left of Finder, so it is not deleted when Downloads is cleared. Your invoices will be kept inside it.</li>
</ol>
</section>

<section id="open">
<h2>Part 3: Open it the first time</h2>
<p>Apple asks you to confirm apps that are not from the App Store. This is needed <b>once</b>.</p>
<ol class="steps">
  <li><strong>Control-click the launcher</strong>In the Free-GST-Billing folder, hold the ${key('Control')} key and click <b>Free GST Billing - MAC</b> (or right-click it, or click with two fingers on a trackpad). Choose ${ui('Open')}.</li>
  <li><strong>Confirm</strong>A box says macOS cannot check the developer. Click ${ui('Open')}.</li>
  <li><strong>On macOS 15 Sequoia or newer, if there is no Open button</strong>Click ${ui('Done')}. Open the Apple menu (the apple logo) → ${ui('System Settings')} → ${ui('Privacy &amp; Security')}, scroll down to the message about <b>Free GST Billing - MAC</b>, click ${ui('Open Anyway')}, type your password, then ${ui('Open Anyway')} again.</li>
  <li><strong>A Terminal window opens</strong>It is a plain text window; you do not need to type anything in it except one key. It says <i>App dependencies not installed yet ... Install now? [Y/n]</i>. Press ${key('Return')}.</li>
  <li><strong>Wait 2 to 3 minutes</strong>Text scrolls past while it sets up. When it says <i>Server running. This window can be closed</i>, the app opens in your browser at <code>http://localhost:47371</code>.</li>
  <li><strong>Close the Terminal window</strong>The app keeps running. A short welcome asks for your business details; see <a href="first-run.html">The first-run setup</a>.</li>
</ol>
</section>

<section id="mac-messages">
<h2>If the Mac shows a message</h2>
<ul>
  <li><strong>"could not be executed because you do not have appropriate access privileges"</strong>: you have a download from before v1.10.82. Download it again (Part 2), or fix this copy: open Terminal (see <a href="terminal.html#mac">Opening Terminal on a Mac</a>), type <code>chmod +x</code> and a space, drag <b>Free GST Billing - MAC</b> from Finder into the Terminal window, press ${key('Return')}, then go back to Part 3.</li>
  <li><strong>"Node.js is not installed"</strong> in the Terminal window: do Part 1, then open the launcher again. If it asks <i>Open the Node.js download page now? [y/N]</i>, type <code>y</code> and press ${key('Return')}.</li>
  <li><strong>"Node.js ... is too old"</strong>: install the current LTS from nodejs.org (Part 1); it replaces the old one.</li>
  <li><strong>"The app cannot reach the internet"</strong> or the install stops: check the Wi-Fi, then open the launcher again; it carries on.</li>
</ul>
<p>More in <a href="troubleshooting.html#mac-blocked">The Mac will not open the launcher</a>.</p>
</section>

<section id="every-day">
<h2>Every day after that</h2>
<ol class="steps">
  <li><strong>Double-click "Free GST Billing - MAC"</strong>After the first time, a normal double-click works. If the app is already running it just opens your browser.</li>
</ol>
<p><b>Tip:</b> make a Desktop shortcut. Control-click the launcher → ${ui('Make Alias')}, and drag the alias to your Desktop. You can also bookmark <code>http://localhost:47371</code> in your browser; it works while the app is running.</p>
<p>To stop the app: in the app open <b>Control Panel</b> in the sidebar and click ${ui('Stop Server')}. Restarting the Mac also stops it.</p>
<p>Your data is in <code>Free-GST-Billing/_system/data</code>. Updating: see <a href="update.html#mac">Updating on a Mac</a>; never drag a new download over the old folder.</p>
</section>
`,
},

// =============================================================================
{
  slug: 'install-linux',
  title: 'Install on Linux or a NAS, step by step',
  nav: 'Install on Linux / NAS',
  lead: 'For Ubuntu, Linux Mint, Debian and similar: install Node.js with two commands you copy and paste, then start the app. Each command is explained.',
  body: `
${which}

<section id="terminal">
<h2>Open the Terminal</h2>
<p>Press ${key('Ctrl', 'Alt', 'T')}. A window opens where you type commands. New to this? Read <a href="terminal.html">Using the Terminal</a> first; it takes two minutes.</p>
<p>To paste a command into the Terminal, use ${key('Ctrl', 'Shift', 'V')} (not ${key('Ctrl', 'V')}), then press ${key('Enter')}.</p>
</section>

<section id="node">
<h2>Step 1: Install Node.js 20</h2>
<p>The Node.js in Ubuntu's own store is often too old for the app, so it comes from NodeSource, the official source for Linux. Paste these one at a time, pressing ${key('Enter')} after each:</p>
<pre><code>sudo apt install -y curl unzip</code></pre>
<pre><code>curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -</code></pre>
<pre><code>sudo apt install -y nodejs</code></pre>
<p><b>When it asks for your password</b>, type the password you use to log in and press ${key('Enter')}. <b>Nothing appears while you type</b>, not even dots; that is normal.</p>
<p>Check it worked:</p>
<pre><code>node -v</code></pre>
<p>It should print <code>v20</code> or higher, for example <code>v20.19.0</code>.</p>
<p><b>Fedora:</b> <code>sudo dnf install nodejs npm</code>. <b>Arch:</b> <code>sudo pacman -S nodejs npm</code>. <b>Alpine / NAS:</b> <code>sudo apk add nodejs npm</code>.</p>
</section>

<section id="download">
<h2>Step 2: Download and unzip</h2>
<ol class="steps">
  <li><strong>Download</strong><a class="download" href="${SITE.download}">Download Free GST Billing</a> It goes into your <b>Downloads</b> folder.</li>
  <li><strong>Unzip it</strong>Paste this in the Terminal and press ${key('Enter')}: it unpacks the app into a folder in your home folder.
<pre><code>cd ~ && unzip -o ~/Downloads/Free-GST-Billing.zip</code></pre></li>
</ol>
</section>

<section id="start">
<h2>Step 3: Start the app</h2>
<pre><code>cd ~/Free-GST-Billing && bash "Free GST Billing - LINUX.sh"</code></pre>
<ol class="steps">
  <li><strong>Press Enter to install</strong>It asks <i>Install now? [Y/n]</i>. Press ${key('Enter')}.</li>
  <li><strong>Wait 2 to 3 minutes</strong>When it says <i>Server running</i>, the app opens in your browser at <code>http://localhost:47371</code>. You can close the Terminal; the app keeps running.</li>
</ol>
<p><b>Every day after that</b>, open the Terminal and run the same command. Or bookmark <code>http://localhost:47371</code>; it works while the app is running. To stop the app: <b>Control Panel</b> in the app → ${ui('Stop Server')}, or restart the computer.</p>
</section>

<section id="nas">
<h2>On a NAS or server (for IT people)</h2>
<pre><code>unzip Free-GST-Billing.zip
cd Free-GST-Billing
bash "_system/install-unix.sh"
bash "_system/start-unix.sh"</code></pre>
<p>The app listens on <code>127.0.0.1:47371</code> only (it has no login, so it is never opened to the network). Updating from inside the app needs <code>unzip</code> or python3.</p>
</section>
`,
},

// =============================================================================
{
  slug: 'update',
  title: 'Updating the app, step by step',
  nav: 'Updating',
  lead: 'A new version comes out every Saturday. Updating keeps all your invoices, clients and settings, and the app backs them up first. The easiest way is one button inside the app.',
  body: `
<section id="in-app">
<h2>The easy way: the Update button (Windows, Mac, Linux)</h2>
<ol class="steps">
  <li><strong>Open the app</strong>When a new version is out, the sidebar shows <b>Update to v…</b> (you can also go to <b>Settings → App Updates</b>).</li>
  <li><strong>Read what is new and click Update Now</strong>A window shows what changed. Click ${ui('Update Now')}.</li>
  <li><strong>Wait about a minute</strong>A window shows the progress; it backs up your data first, then updates.</li>
  <li><strong>Reload the page</strong>Press ${key('F5')} (on a Mac ${key('Cmd', 'R')}). The version at the bottom of the Dashboard shows the new number.</li>
</ol>
<p>Changes still look the same? Press ${key('Ctrl', 'F5')} (Mac: ${key('Cmd', 'Shift', 'R')}) to make the browser load the new version.</p>
</section>

<section id="windows">
<h2>Windows: other ways</h2>
<p><b>From the launcher:</b> double-click <b>Free GST Billing</b> on your Desktop → ${ui('More options')} → ${ui('Update to the latest version')} → then ${ui('Open App')}.</p>
<p><b>By hand, with the ZIP</b> (if the app does not open at all):</p>
<ol class="steps">
  <li><strong>Download</strong><a class="download" href="${SITE.download}">Download Free GST Billing</a></li>
  <li><strong>Stop the app</strong>Launcher → ${ui('More options')} → ${ui('Stop the app')}.</li>
  <li><strong>Extract into the same place as before</strong>Right-click the ZIP → ${ui('Extract All\u2026')} → ${ui('Browse\u2026')} → choose the folder that <i>contains</i> your Free-GST-Billing folder (for example <b>Documents</b>) → ${ui('Extract')}.</li>
  <li><strong>Replace the files</strong>Windows asks about files that already exist: choose ${ui('Replace the files in the destination')}. On Windows this <b>adds</b> to your folder; your <code>_system\\data</code> folder is not touched.</li>
  <li><strong>Open the app</strong>Double-click <b>Free GST Billing - WINDOWS</b> → ${ui('Open App')}. The first start after an update takes a minute.</li>
</ol>
<p>If you extracted the new ZIP somewhere else and opened its launcher, it says <i>Free GST Billing is already installed on this computer</i> and offers ${ui('Update the installed copy')}: use that, and delete the new folder.</p>
</section>

<section id="mac">
<h2>Mac: other ways</h2>
<p>Use the <a href="#in-app">Update button</a> in the app. That is the safe way on a Mac.</p>
<div class="note warn"><strong>Never drag a new download over your old folder on a Mac</strong>
<p>On a Mac, Finder's ${ui('Replace')} swaps the <b>whole</b> folder, including <code>_system/data</code> with all your invoices. (Windows merges folders; the Mac does not.)</p></div>
<p>If the app will not open and you need the new download:</p>
<ol class="steps">
  <li><strong>Back up first</strong>If the app opens: <b>Settings → Data Management → Export Backup…</b>.</li>
  <li><strong>Download and unzip the new version</strong>It appears as a new folder (macOS may call it <b>Free-GST-Billing 2</b>).</li>
  <li><strong>Move your data across</strong>In your <b>old</b> folder open <code>_system</code> (if you cannot see it, press ${key('Cmd', 'Shift', '.')} in Finder to show hidden folders) and copy the <code>data</code> folder. In the <b>new</b> folder open <code>_system</code> and paste it (${key('Cmd', 'V')}), choosing ${ui('Replace')} for that <b>data</b> folder only.</li>
  <li><strong>Open the new launcher</strong>As in <a href="install-mac.html#open">Install on a Mac, Part 3</a>. When everything works, you can delete the old folder.</li>
</ol>
</section>

<section id="linux">
<h2>Linux: other ways</h2>
<p>Use the Update button, or in the Terminal:</p>
<pre><code>sh ~/Free-GST-Billing/_system/update-unix.sh</code></pre>
<p>It downloads the newest version, checks every file, keeps <code>_system/data</code>, and rolls back if anything fails. Restart the app afterwards.</p>
</section>
`,
},

// =============================================================================
{
  slug: 'terminal',
  title: 'Using the Terminal, for beginners',
  nav: 'Using the Terminal',
  lead: 'Some fixes ask you to type a command. The Terminal (Command Prompt on Windows) is just a window where you type an instruction and press Enter. This page shows how, on every computer.',
  body: `
<section id="what">
<h2>What it is</h2>
<p>A plain window with a blinking cursor. You type (or paste) one line, press ${key('Enter')} (Mac: ${key('Return')}), and the computer does it and prints the result. You cannot break anything by opening it, and closing the window is always safe.</p>
</section>

<section id="windows">
<h2>Opening it on Windows</h2>
<ol class="steps">
  <li><strong>Press Windows + R</strong>A small <b>Run</b> box opens at the bottom left.</li>
  <li><strong>Type <code>cmd</code> and press Enter</strong>A black <b>Command Prompt</b> window opens.</li>
</ol>
<p>To paste a command: ${key('Ctrl', 'V')}, or right-click inside the window. Then press ${key('Enter')}.</p>
<p><b>Example:</b> to see your Node.js version, type <code>node -v</code> and press ${key('Enter')}. It prints something like <code>v20.19.0</code>. If it prints <i>not recognized</i>, Node.js is not installed for the whole PC, which is fine: the app keeps its own copy.</p>
</section>

<section id="mac">
<h2>Opening it on a Mac</h2>
<ol class="steps">
  <li><strong>Press Cmd + Space</strong>The Spotlight search bar opens in the middle of the screen.</li>
  <li><strong>Type <code>Terminal</code> and press Return</strong>A white or black <b>Terminal</b> window opens.</li>
</ol>
<p>Or: <b>Finder</b> → <b>Applications</b> → <b>Utilities</b> → <b>Terminal</b>.</p>
<p>To paste a command: ${key('Cmd', 'V')}, then ${key('Return')}.</p>
</section>

<section id="linux">
<h2>Opening it on Linux</h2>
<p>Press ${key('Ctrl', 'Alt', 'T')}, or search for <b>Terminal</b> in your apps. To paste: ${key('Ctrl', 'Shift', 'V')}, then ${key('Enter')}.</p>
</section>

<section id="tips">
<h2>Four things worth knowing</h2>
<ul>
  <li><strong>Drag a file in to type its location.</strong> Instead of typing a long folder path, drag the file from Finder or File Explorer into the Terminal window; its full path appears, ready to use.</li>
  <li><strong>Passwords are invisible.</strong> When it asks for your password, nothing appears as you type, not even dots. Type it anyway and press ${key('Enter')}.</li>
  <li><strong>Names with spaces need quotes.</strong> <code>"Free GST Billing - MAC.command"</code>. Dragging the file in adds what is needed for you.</li>
  <li><strong>To stop a command</strong> that keeps running, press ${key('Ctrl', 'C')}.</li>
</ul>
</section>

<section id="example">
<h2>Example: fixing the Mac launcher</h2>
<p>If a Mac says the launcher <i>could not be executed because you do not have appropriate access privileges</i>:</p>
<ol class="steps">
  <li><strong>Open Terminal</strong>${key('Cmd', 'Space')}, type <code>Terminal</code>, ${key('Return')}.</li>
  <li><strong>Type the start of the command</strong>Type <code>chmod +x</code> and then one space. Do not press Return yet.</li>
  <li><strong>Drag the launcher in</strong>Drag <b>Free GST Billing - MAC</b> from your Free-GST-Billing folder into the Terminal window. The line now ends with its location.</li>
  <li><strong>Press Return</strong>Nothing is printed: that means it worked. Close Terminal and open the launcher again (Control-click → ${ui('Open')}).</li>
</ol>
</section>
`,
},
];
