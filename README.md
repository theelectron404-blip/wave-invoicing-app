# Wave Invoicing & Email Dispatch Web App (Vercel Ready)

A production-ready Next.js web application to create customized invoices and dispatch them with custom email subjects, bodies, recipient lists, and attached PDFs directly using the **Wave GraphQL API**.

---

## ✨ Features

- **Dynamic Invoice Builder:**
  - Create and manage dynamic line items (products, descriptions, quantities, unit prices, subtotal calculations).
  - Custom invoice numbers, issue dates, due dates, customer memos, and footer text.
  - Multi-business and customer selection, with in-app customer creation modal.

- **Full Email Customization via Wave API:**
  - Customize recipient email address(es).
  - Customize email **Subject line** directly via API.
  - Customize email **Message / Body** directly via API.
  - Toggle **PDF Attachment** (`attachPDF: true`).

- **Live Invoice Preview:**
  - Real-time side-by-side visual preview of the invoice before dispatching.

- **Vercel Deployment Ready:**
  - Built with Next.js (App Router), TypeScript, and Tailwind CSS.
  - Proxy API routes keep your `WAVE_API_TOKEN` secure on the server side.

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Wave API Credentials
Create a `.env.local` file in the root directory (or copy from `.env.example`):

```bash
WAVE_API_TOKEN=your_wave_personal_access_token_here
WAVE_BUSINESS_ID=your_business_id_here
```

> **How to get your Wave API Token:**
> 1. Log in to your [Wave Account](https://www.waveapps.com/).
> 2. Go to the [Wave Developer Portal](https://developer.waveapps.com/).
> 3. Click **Manage Applications** &rarr; **Create an Application** (or select an existing one).
> 4. Go to the **Tokens** section and generate a **Full Access Token**.

### 3. Run Locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌐 Deploy to Vercel

1. Push this repository to GitHub / GitLab / Bitbucket.
2. Import the repository in [Vercel](https://vercel.com/new).
3. In Vercel's **Environment Variables** section, add:
   - `WAVE_API_TOKEN`
   - `WAVE_BUSINESS_ID` (optional, can also be selected in UI)
4. Click **Deploy**.

---

## 🛠️ Tech Stack
- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **API:** Wave GraphQL API (`https://gql.waveapps.com/graphql/public`)
