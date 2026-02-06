<div align="center">

# 🚀 KAAPAV WhatsApp

### Enterprise-grade WhatsApp Business API Platform

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-Business_API-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://business.whatsapp.com/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

**A complete WhatsApp Business alternative for e-commerce — send messages, manage orders, process payments, and automate customer engagement via API.**

[📖 API Docs](API.md) • [🚀 Deploy](DEPLOYMENT.md) • [⚙️ Setup](docs/SETUP.md)

</div>

---

## ✨ Features

### 💬 **Chat Management**
- Real-time WhatsApp messaging via Cloud API
- Multi-agent chat assignment
- Quick replies & message templates
- Media support (images, videos, documents, audio)
- Message status tracking (sent, delivered, read)

### 🛒 **E-Commerce Integration**
- Product catalog sync with WhatsApp
- Shopping cart management
- Order creation from chat
- Abandoned cart recovery
- Customer segmentation & tiers

### 💳 **Payment Processing**
- Razorpay integration for payments
- Payment link generation via WhatsApp
- Webhook-based payment confirmation
- Order status auto-updates

### 📦 **Shipping & Logistics**
- Shiprocket integration
- Auto shipment creation
- Tracking updates via WhatsApp
- Delivery notifications

### 📢 **Marketing & Automation**
- Broadcast campaigns
- Template message scheduling
- Workflow automation triggers
- Customer journey flows

### 📊 **Analytics Dashboard**
- Message analytics
- Order statistics
- Revenue tracking
- Customer insights

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        KAAPAV Platform                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐   │
│  │   Frontend   │────▶│    Worker    │────▶│  WhatsApp    │   │
│  │  React PWA   │     │  (REST API)  │     │  Cloud API   │   │
│  └──────────────┘     └──────────────┘     └──────────────┘   │
│         │                    │                                  │
│         │              ┌─────┴─────┐                           │
│         │              │           │                           │
│         ▼              ▼           ▼                           │
│  ┌──────────────┐  ┌────────┐  ┌────────┐  ┌────────────┐    │
│  │   Browser    │  │   D1   │  │   KV   │  │     R2     │    │
│  │   Storage    │  │  (SQL) │  │ Cache  │  │   Media    │    │
│  └──────────────┘  └────────┘  └────────┘  └────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Cloudflare Workers (Edge Runtime) |
| **Database** | Cloudflare D1 (SQLite) |
| **Cache** | Cloudflare KV |
| **Media Storage** | Cloudflare R2 |
| **Frontend** | React 18 + Vite + TailwindCSS |
| **State** | Zustand |
| **Charts** | Recharts |
| **Animations** | Framer Motion |
| **Payments** | Razorpay |
| **Shipping** | Shiprocket |
| **Messaging** | WhatsApp Cloud API |

---

## 📁 Project Structure

```
kaapav-whatsapp/
├── worker/                    # Cloudflare Worker Backend
│   ├── src/
│   │   ├── index.js          # Main router
│   │   ├── config.js         # Configuration
│   │   ├── handlers/         # API route handlers
│   │   │   ├── webhook.js    # WhatsApp webhooks
│   │   │   ├── auth.js       # Authentication
│   │   │   ├── chat.js       # Chat operations
│   │   │   ├── message.js    # Send messages
│   │   │   ├── order.js      # Order management
│   │   │   ├── product.js    # Product catalog
│   │   │   ├── payment.js    # Razorpay integration
│   │   │   ├── shipping.js   # Shiprocket integration
│   │   │   ├── broadcast.js  # Campaign management
│   │   │   ├── automation.js # Workflow automation
│   │   │   └── analytics.js  # Dashboard stats
│   │   ├── services/         # External API integrations
│   │   ├── middleware/       # Auth, CORS, Rate limiting
│   │   ├── flows/            # Conversation flows
│   │   └── cron/             # Scheduled tasks
│   ├── schema.sql            # Database schema
│   ├── wrangler.toml         # Cloudflare config
│   └── package.json
│
├── frontend/                  # React PWA Dashboard
│   ├── src/
│   │   ├── screens/          # Page components
│   │   ├── components/       # Reusable UI components
│   │   ├── api/              # API client
│   │   ├── store/            # Zustand stores
│   │   └── utils/            # Helper functions
│   ├── public/               # Static assets & PWA
│   └── package.json
│
├── docs/                      # Documentation
│   └── SETUP.md
├── API.md                     # API Reference
├── DEPLOYMENT.md              # Deployment Guide
└── README.md                  # This file
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or pnpm
- [Cloudflare account](https://cloudflare.com)
- [WhatsApp Business Account](https://business.facebook.com)
- [Razorpay account](https://razorpay.com) (for payments)
- [Shiprocket account](https://shiprocket.in) (for shipping)

### 1. Clone & Install

```bash
git clone https://github.com/Kaapav/kaapav-whatsapp.git
cd kaapav-whatsapp

# Install worker dependencies
cd worker && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### 2. Configure Environment

```bash
# In worker directory
cp .env.example .dev.vars

# Edit .dev.vars with your credentials
```

### 3. Initialize Database

```bash
cd worker

# Create D1 database
npm run db:create

# Initialize schema
npm run db:init:local
```

### 4. Start Development

```bash
# Terminal 1: Start API
cd worker && npm run dev

# Terminal 2: Start Frontend
cd frontend && npm run dev
```

### 5. Open Dashboard

Visit `http://localhost:5173` in your browser.

---

## 🔐 Environment Variables

### Worker Secrets (set via `wrangler secret put`)

| Variable | Description |
|----------|-------------|
| `WA_PHONE_ID` | WhatsApp Phone Number ID |
| `WA_TOKEN` | WhatsApp API Access Token |
| `WA_APP_SECRET` | WhatsApp App Secret (for webhook verification) |
| `RAZORPAY_KEY_ID` | Razorpay Key ID |
| `RAZORPAY_KEY_SECRET` | Razorpay Key Secret |
| `SHIPROCKET_EMAIL` | Shiprocket account email |
| `SHIPROCKET_PASSWORD` | Shiprocket account password |
| `JWT_SECRET` | Secret for JWT token signing |
| `API_KEY` | API key for external integrations |
| `VAPID_PUBLIC_KEY` | Web push public key |
| `VAPID_PRIVATE_KEY` | Web push private key |

---

## 📚 Documentation

- **[API Reference](API.md)** - Complete API documentation
- **[Deployment Guide](DEPLOYMENT.md)** - Production deployment steps
- **[Setup Guide](docs/SETUP.md)** - Detailed configuration instructions

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Cloudflare Workers](https://workers.cloudflare.com/) for edge computing
- [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/) for messaging
- [Razorpay](https://razorpay.com/) for payment processing
- [Shiprocket](https://shiprocket.in/) for logistics

---

<div align="center">

**Built with ❤️ by [KAAPAV](https://github.com/Kaapav)**

</div>
