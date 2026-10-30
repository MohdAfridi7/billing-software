import { SITE } from '../site.mjs';

const ui = (s) => `<span class="ui">${s}</span>`;
const img = (f) => `assets/img/${f}`;

export default [
// =============================================================================
{
  slug: 'index',
  title: 'Free GST Billing documentation',
  nav: 'Welcome',
  lead: 'Make GST invoices, keep track of who owes you, and prepare your GST returns. On your own computer, with no account and no monthly fee.',
  body: `
<ul class="doors">
  <li><a href="install.html"><b>Install it</b><span>Download, extract, click Install. About three minutes, no admin rights needed.</span></a></li>
  <li><a href="first-invoice.html"><b>Make your first invoice</b><span>From a blank app to a GST tax invoice you can send, in five minutes.</span></a></li>
  <li><a href="troubleshooting.html"><b>Something isn't working</b><span>The common problems, what causes each one, and the fix.</span></a></li>
</ul>

<section id="what-it-does">
<h2>What it does</h2>
<p>Free GST Billing is invoicing and GST software for small businesses in India, and for anyone billing in other currencies: 20 are supported. It runs on your computer and opens in your web browser, the way a website does, but nothing leaves your machine.</p>
<ul>
  <li><strong>Invoices</strong>: tax invoices, bills of supply, proforma estimates, credit notes and delivery challans, with CGST, SGST, IGST and UTGST worked out for you.</li>
  <li><strong>Getting paid</strong>: record payments, print receipts, see who is overdue and by how much.</li>
  <li><strong>GST returns</strong>: GSTR-1 and GSTR-3B built from your invoices and purchases, as files you upload to the GST portal.</li>
  <li><strong>The rest of the books</strong>: clients, products and stock, purchases, expenses, recurring invoices, profit and loss, and an income tax calculator.</li>
</ul>
</section>

<section id="requirements">
<h2>What you need</h2>
<table>
  <tr><th>Computer</th><td>Windows 10 or 11, macOS, or Linux (a NAS works too).</td></tr>
  <tr><th>Browser</th><td>Chrome, Edge, Firefox or Brave. The app opens in it.</td></tr>
  <tr><th>Disk space</th><td>Roughly 200 MB once installed.</td></tr>
  <tr><th>Internet</th><td>Only for the first install and for updates. Everything else works offline.</td></tr>
  <tr><th>Account or signup</th><td>None.</td></tr>
</table>
</section>

<section id="your-data">
<h2>Where your data lives</h2>
<p>Every invoice, client and setting is saved as plain files inside the app's folder, in <code>_system\\data</code>. They never leave your computer unless you turn on Google Drive backup yourself.</p>
<p>That also means backing up is your job, and it is easy. See <a href="backup.html">Backups, updates and moving PC</a>.</p>
</section>

<section id="is-it-free">
<h2>Is it really free?</h2>
<p>Yes. It is open source under the MIT licence. There is no trial, no invoice limit, no feature that unlocks for money, and no advertising. The code is public on <a href="${SITE.repo}">GitHub</a>, so anyone can check what it does.</p>
</section>

<section id="get-help">
<h2>Getting help</h2>
<p>Every screen in the app with a ${ui('?')} button links to the matching part of these pages. If something is missing here, or the app does something these pages don't describe, <a href="${SITE.repo}/issues">open an issue on GitHub</a> with a screenshot. Many features began as someone's request.</p>
</section>
`,
},

// =============================================================================
{
  slug: 'first-run',
  title: 'The first-run setup',
  nav: 'First-run setup',
  lead: 'The screens you see the first time the app opens: a four-step welcome for your business details, then a three-step setup for how your invoices look. Both can be skipped and changed later.',
  body: `
<section id="welcome">
<h2>Step 1 of the welcome: where you invoice from</h2>
<p>The first screen explains what the app does, and asks <b>Where will you be invoicing from?</b></p>
<table>
  <tr><td>🇮🇳 India</td><td>GST, GSTR-1 and 3B, UPI. The default.</td></tr>
  <tr><td>🌍 Outside India</td><td>VAT and other local taxes</td></tr>
  <tr><td>🌐 Both</td><td>India, with clients abroad</td></tr>
</table>
<p>${ui('Get Started')} carries on. ${ui('Skip Setup')} goes straight to the app; fill in <a href="settings.html#company-details">Settings</a> later.</p>
</section>

<section id="business-details">
<h2>Step 2: business details</h2>
<p>These print at the top of every invoice. Only the <b>Business Name</b> is required.</p>
<table>
  <tr><td>Business Name</td><td>Required</td></tr>
  <tr><td>Address</td><td>Your full address</td></tr>
  <tr><td>State</td><td>Needed to work out CGST and SGST versus IGST</td></tr>
  <tr><td>GSTIN</td><td>Leave blank if you are not registered</td></tr>
  <tr><td>PAN, Phone, Email</td><td>Optional</td></tr>
</table>
</section>

<section id="bank-upi">
<h2>Step 3: bank and UPI</h2>
<p>Where clients should pay you: bank name, account number, IFSC code and UPI ID. A UPI ID puts a scan-to-pay QR code on your invoices. You can also upload your logo and signature here, up to 500 KB each. ${ui('Skip, I’ll add later')} leaves it all for <a href="settings.html#payment-accounts">Settings</a>.</p>
</section>

<section id="all-set">
<h2>Step 4: you're all set</h2>
<p>A short list of what to do next. ${ui('Start Billing')} saves everything; your bank details become your first <a href="settings.html#payment-accounts">payment account</a>.</p>
</section>

<section id="setup-wizard">
<h2>Then: setting up your invoices</h2>
<p>Next, a three-step window sets up printing.</p>
<ol class="steps">
  <li><strong>What kind of business do you run?</strong>Pick one of six: Retail Shop / Kirana, Freelancer / Consultant, Restaurant / Cafe / Bar, Wholesale / Trading, Manufacturing, or Service / Repair Shop. Each sets the invoice style, receipt options and features that suit that business. See <a href="print-settings.html#business-type">Business type</a> for exactly what each one sets. Or choose <b>None of these</b> to set things up yourself.</li>
  <li><strong>Paper size and language</strong>Pick what you mostly print on: A4, A5, 80 mm or 58 mm thermal. It becomes the paper size of new invoices. Then the language for section labels such as BILL TO: English, Hindi, Tamil, Marathi or Bengali.</li>
  <li><strong>Ready to go</strong>A summary of your choices. ${ui('Finish setup')} applies them.</li>
</ol>
<p>${ui('Skip setup')}, or the ${ui('✕')}, closes it. A ${ui('✨ Finish setup')} button then waits at the bottom right of the screen, for whenever you want to come back to it. Everything it sets can also be changed in <a href="print-settings.html">Print and PDF settings</a>.</p>
</section>
`,
},

// =============================================================================
{
  slug: 'first-invoice',
  title: 'Your first invoice',
  lead: 'From a blank app to a GST tax invoice you can send, in about five minutes.',
  body: `
<section id="before-you-start">
<h2>Before you start</h2>
<p>Have these to hand: your business name, address and GSTIN, and your bank account or UPI ID if you want clients to pay you directly from the invoice. None of it is compulsory, and all of it can be added later.</p>
</section>

<section id="walkthrough">
<h2>Make the invoice</h2>
<ol class="steps">
  <li><strong>Add your business details</strong>If you skipped the welcome, open ${ui('Settings')} and fill in <b>Company Details</b>. This is the header of every invoice. Your state matters: it decides whether GST is split into CGST and SGST, or charged as IGST.</li>
  <li><strong>Start a new invoice</strong>Click ${ui('New Invoice')} in the sidebar. <b>Tax Invoice</b> is already selected, which is the right choice for a normal GST sale.</li>
  <li><strong>Add the client</strong>Under <b>Billed To</b>, type the client's name. If they are registered for GST, type their GSTIN and their state fills in by itself. A mistyped GSTIN is caught straight away.</li>
  <li><strong>Add what you sold</strong>For each line, give a description, quantity, unit, rate and GST rate. The HSN or SAC code is optional but helps your GST return. Clicking a number field selects what is there, so you can just type.</li>
  <li><strong>Check the tax</strong>The preview on the right shows the totals. Same state as you: CGST and SGST. Another state: IGST. You do not need to choose.</li>
  <li><strong>Save and download</strong>Click ${ui('Save &amp; Download')}. The invoice gets its number, is saved to your records, and downloads as a PDF.</li>
</ol>
<figure><img src="${img('toolbar.png')}" alt="The invoice toolbar: Save, Save and Download, Print, WhatsApp, E-Way Bill, Customize, Hide Preview"><figcaption>The invoice toolbar stays at the top of the screen as you scroll.</figcaption></figure>
</section>

<section id="send">
<h2>Send it</h2>
<ul>
  <li>${ui('WhatsApp')} opens a message to the client. On a phone the PDF is attached for you; on a computer, WhatsApp does not let websites attach files, so download the PDF and drag it into the chat.</li>
  <li>${ui('Print')} opens your printer directly, including thermal receipt printers.</li>
  <li>Or attach the downloaded PDF to an email yourself.</li>
</ul>
</section>

<section id="get-paid">
<h2>When the client pays</h2>
<p>On the <a href="dashboard.html">Dashboard</a>, find the invoice and record the payment. A printable receipt opens straight away, and the invoice's status changes to <b>Partial</b> or <b>Paid</b>. Unpaid invoices past their due date are marked <b>Overdue</b> for you.</p>
</section>

<section id="whats-next">
<h2>What to do next</h2>
<ul>
  <li><a href="products.html">Add your products and services</a>, so you pick them from a list instead of typing them each time.</li>
  <li><a href="settings.html#payment-accounts">Add your bank or UPI</a>, so a payment QR code prints on every invoice.</li>
  <li><a href="settings.html#branding">Add your logo, signature and stamp</a>.</li>
  <li>At the end of the month, <a href="gst-returns.html">prepare your GST returns</a> from the invoices you have made.</li>
</ul>
<p>The <b>Getting started</b> list on the Dashboard tracks these for you, and ticks each one off once it is done.</p>
</section>
`,
},
];
