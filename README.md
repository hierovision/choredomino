# Chore Domino

A free, lightweight Progressive Web App designed to make household chore management enjoyable through gamification and mutual reward systems.

## 🎯 Philosophy

When our homes are chaotic or unpleasant, we spend mental and emotional energy on basic survival rather than growth, creativity, and connection. Chore Domino helps families and households create systems that make home maintenance feel rewarding rather than burdensome.

## ✨ Key Features

- **Collaborative Management**: Shared household dashboard with fair task distribution
- **Gamification**: Points system with customizable rewards
- **Offline-First**: Works without internet, syncs when connected
- **Real-Time Updates**: See changes across all devices instantly
- **Privacy-Focused**: Data stays local by default, optional cloud sync
- **Free & Open Source**: No subscriptions, no hidden costs

## 🏗️ Architecture

### Tech Stack

- **Frontend**: Vue 3 + TypeScript + Vite
- **UI Framework**: Vuetify 3 (Material Design)
- **Local Database**: RxDB with LocalStorage
- **Backend**: Supabase (Postgres)
- **State Management**: Pinia
- **PWA**: vite-plugin-pwa

### Data Flow

```
┌─────────────────────────────────────┐
│  Vue 3 App (Vuetify UI)             │
│  ┌─────────────────────────────┐    │
│  │  Pinia Stores               │    │
│  └──────────┬──────────────────┘    │
│             │                        │
│  ┌──────────▼──────────────────┐    │
│  │  RxDB (Local Database)      │    │
│  │  - Reactive Queries         │    │
│  │  - Offline Storage          │    │
│  └──────────┬──────────────────┘    │
│             │ Replication            │
└─────────────┼────────────────────────┘
              │ HTTPS
              ▼
   ┌──────────────────────────┐
   │  Supabase (PostgreSQL)   │
   │  - Real-time Sync        │
   │  - Row Level Security    │
   └──────────────────────────┘
```

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- Yarn >= 1.22.0

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/hierovision/choredomino.git
   cd choredomino
   ```

2. **Install dependencies**
   ```bash
   yarn install
   ```

3. **Set up environment variables**
   
   **For local development:**
   ```bash
   cp .env.local.example .env.local
   ```
   
   Edit `.env.local` and add your **DEV** Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://your-dev-project.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_your-dev-key
   ```
   
   > **Key Selection:** Use "Publishable key" (`sb_publishable_...`), NOT legacy "anon" JWT.
   > - Publishable keys allow instant rotation without mobile app downtime
   > - Get from: Supabase Dashboard → Settings → API → "Publishable key"
   
   > **Security Model:** Publishable key is PUBLIC (embedded in client). Real security = RLS policies.
   
   > **Environment Strategy:**
   > - **Local** → `.env.local` with DEV Supabase
   > - **PR previews** → DEV Supabase (GitHub secrets: `VITE_SUPABASE_URL_DEV`, `VITE_SUPABASE_ANON_KEY_DEV`)
   > - **Production** → PROD Supabase (GitHub secrets: `VITE_SUPABASE_URL_PROD`, `VITE_SUPABASE_ANON_KEY_PROD`)

4. **Run development server**
   ```bash
   yarn dev
   ```
   
   App will be available at `http://localhost:3000`

### Building for Production

```bash
yarn build
yarn preview
```

## 🚀 Deployment

### Azure Static Web Apps (Recommended)

Chore Domino is designed to deploy seamlessly to Azure Static Web Apps:

**Prerequisites:**
- Azure account (free tier available)
- GitHub repository

**Deploy Steps:**

1. **Create Azure Static Web App**
   - Go to [Azure Portal](https://portal.azure.com)
   - Create new Static Web App
   - Connect to your GitHub repo
   - Build settings:
     - App location: `dist`
     - Output location: `` (empty)
     - Build command: Handled by GitHub Actions
   
   **Current Deployment:**
   - URL: https://happy-hill-05779860f.2.azurestaticapps.net
   - GitHub Actions workflow handles build and deploy

2. **Environment Variables**
   
   Add these as **GitHub Secrets** (Settings → Secrets and variables → Actions):
   
   **Supabase (4 secrets):**
   - `VITE_SUPABASE_URL_DEV` + `VITE_SUPABASE_ANON_KEY_DEV` - DEV project (from Settings → API)
   - `VITE_SUPABASE_URL_PROD` + `VITE_SUPABASE_ANON_KEY_PROD` - PROD project
   - Use **Publishable key** (`sb_publishable_...`), NOT legacy "anon" JWT key
   
   **Azure (4 secrets - already configured):**
   - `AZURE_STATIC_WEB_APPS_API_TOKEN` - Auto-added by Azure
   - `AZURE_CREDENTIALS` - Service principal JSON (clientId, clientSecret, subscriptionId, tenantId)
   - `AZURE_STATIC_WEB_APP_NAME` - choredomino
   - `AZURE_RESOURCE_GROUP` - choredomino_group
   
   **DNS (2 secrets - for choredomino.com):**
   - `PORKBUN_API_KEY` + `PORKBUN_SECRET_KEY`
   
   ```bash
   # Add Supabase secrets via CLI:
   gh secret set VITE_SUPABASE_URL_DEV --body "https://your-dev-project.supabase.co"
   gh secret set VITE_SUPABASE_ANON_KEY_DEV --body "sb_publishable_..."
   gh secret set VITE_SUPABASE_URL_PROD --body "https://your-prod-project.supabase.co"
   gh secret set VITE_SUPABASE_ANON_KEY_PROD --body "sb_publishable_..."
   ```
   
   > **Environment Behavior:**
   > - **Production** (push to `main`): Uses PROD Supabase
   > - **Preview** (pull requests): Uses DEV Supabase
   > - **Local**: Uses `.env.local` file (DEV Supabase)

3. **Custom Domain (Optional)**
   - Azure Portal → Custom domains
   - Add your domain (HTTPS automatic via Let's Encrypt)

**What happens:**
- Push to `main` → GitHub Actions builds → Auto-deploys
- Pull requests get staging URLs automatically
- Global CDN ensures fast load times worldwide
- Service worker caches app for offline use

### Alternative Platforms

Chore Domino also works great on:
- **Netlify**: Similar to Azure SWA, great DX
- **Vercel**: Optimized for frontend frameworks
- **Cloudflare Pages**: Fast edge network
- **GitHub Pages**: Free, simple, but requires manual builds

## 📊 Database Schema

**Phase 1 (Deployed):** households, household_members, user_profiles  
**Phase 2 (Pending):** chores, chore_completions  
**Phase 3 (Pending):** rewards, reward_redemptions

### Migration Deployment

1. **Via Supabase Dashboard** (easiest):
   - SQL Editor → Copy/paste from `supabase/migrations/00X_*.sql` → Run
   
2. **Via CLI**: `supabase db push` (after linking project)

All tables include `_modified` (timestamp for sync) and `_deleted` (soft delete flag).

## 🔄 Sync Strategy

- **RxDB Polling**: Queries `WHERE _modified > lastSync` every 30-60s
- **Supabase Realtime**: WebSocket notifications trigger immediate sync
- **Offline-First**: All data local, syncs when online
- **Conflict Resolution**: Handled by RxDB (last-write-wins)

## 🔐 Security Model

- **Publishable Key**: PUBLIC (embedded in client code) - provides DoS protection only
- **Real Security**: Supabase Row Level Security (RLS) policies at database level
- **Household Isolation**: Users can only access their household data via RLS
- **Auth**: Supabase Auth with email/password, auto-creates user profile on signup
- **Open Source**: Fully auditable code

## 🗺️ Roadmap

### MVP (Phase 1)
- [x] Project architecture
- [x] RxDB + Supabase integration
- [ ] Household creation/joining
- [ ] Chore management (CRUD)
- [ ] Completion workflow (kid marks done → parent approves)
- [ ] Points system
- [ ] Basic rewards

### Phase 2 (Premium Features)
- [ ] Multiple households per user
- [ ] Advanced analytics & charts
- [ ] Custom themes
- [ ] Calendar integration
- [ ] Export/backup tools

## 🤝 Contributing

Contributions are welcome! This project is built to serve families regardless of economic status.

### Development Setup

1. Follow installation steps above
2. Create a feature branch
3. Make your changes
4. Test thoroughly (especially offline scenarios)
5. Submit a PR

### Code Style

- TypeScript strict mode
- Vue 3 Composition API
- ESLint + Prettier (coming soon)

## 📝 License

MIT License - see [LICENSE](LICENSE) for details

## 🙏 Acknowledgments

- Built with [RxDB](https://rxdb.info/) - Reactive Database for JavaScript
- Backend powered by [Supabase](https://supabase.com/)
- UI components from [Vuetify](https://vuetifyjs.com/)

## 📧 Contact

- GitHub: [@hierovision](https://github.com/hierovision)
- Project: [choredomino](https://github.com/hierovision/choredomino)

---

**Made with ❤️ for families everywhere**
