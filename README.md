# Mivna - AI-Powered Architecture Documentation

> Transform your codebase into beautiful, interactive architecture diagrams and comprehensive README documentation powered by AI.

## 🚀 Features

- **🎨 AI-Generated Diagrams** - Automatically create Mermaid.js flowcharts from your repository structure
- **📝 Smart README Generation** - Generate comprehensive, professional README files
- **💡 Interactive Explanations** - Click on any diagram component to get AI-powered explanations
- **🔍 GitHub Integration** - Seamless OAuth authentication and repository access
- **🎯 Beautiful UI** - Modern, dark-mode interface with smooth interactions
- **⚡ Real-time Updates** - Regenerate diagrams and docs as your code evolves

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Supabase Edge Functions
- **AI**: Google Gemini 2.0 Flash
- **Diagrams**: Mermaid.js
- **Auth**: GitHub OAuth
- **Database**: PostgreSQL (Supabase)

## 📦 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account
- GitHub OAuth App
- Google AI Studio API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd mivna-frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```
   
   Fill in your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   
   Navigate to `http://localhost:5173`

## 🚢 Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions for Vercel, Netlify, or self-hosted options.

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Project Structure

```
src/
├── components/     # Reusable UI components
├── hooks/          # Custom React hooks
├── lib/            # Utilities and helpers
├── pages/          # Page components
└── index.css       # Global styles
```

## 🎯 Core Features

### AI-Powered Diagram Generation

Mivna analyzes your repository structure, configuration files, and code organization to generate comprehensive architecture diagrams that show:

- Application layers (Frontend, Backend, Data)
- Component relationships and data flow
- Key technologies and frameworks
- External dependencies

### Intelligent README Creation

Generate professional README files that include:

- Project overview and description
- Feature highlights
- Technology stack analysis
- Installation instructions
- Architecture explanations

### Interactive Exploration

- **Pan & Zoom**: Navigate large diagrams with smooth controls
- **Click to Explain**: Get AI-generated explanations for any component
- **Real-time Updates**: Regenerate docs as your code evolves
- **Export Options**: Download diagrams as PNG/SVG or READMEs as Markdown

## 🔐 Security

- Row Level Security (RLS) on all database tables
- JWT verification on all Edge Functions
- Zero data retention - your code is processed in memory only
- Minimal GitHub OAuth scopes (`repo`, `read:user`)

## 📝 License

[Your License Here]

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## 💬 Support

- **Issues**: [GitHub Issues](your-repo-url/issues)
- **Discussions**: [GitHub Discussions](your-repo-url/discussions)
- **Email**: support@mivna.com

---

Made with ❤️ using React, Supabase, and Google Gemini AI
