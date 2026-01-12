# Mivna Frontend - Production Deployment Guide

## Prerequisites

Before deploying to production, ensure you have:

1. **Supabase Project** set up with:
   - GitHub OAuth provider configured
   - Required database tables (`profiles`, `repositories`)
   - Edge functions deployed (`generate-diagram`, `generate-readme`, `explain-node`)

2. **GitHub OAuth App** configured in GitHub Developer Settings:
   - Homepage URL: `https://your-production-domain.com`
   - Authorization callback URL: `https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback`

---

## Environment Variables

Create a `.env` file in the project root (use `.env.example` as template):

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

> ⚠️ **Never commit `.env` files to version control!** The `.gitignore` already excludes them.

---

## Building for Production

```bash
# Install dependencies
npm install

# Build the production bundle
npm run build

# Preview the production build locally
npm run preview
```

The build output will be in the `dist/` directory.

---

## Deployment Options

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Deploy automatically on push to main

### Netlify

1. Connect your GitHub repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Add environment variables in Netlify dashboard

### Self-Hosted (nginx)

1. Build the project: `npm run build`
2. Copy `dist/` contents to your web server
3. Configure nginx for SPA routing:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/mivna/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## GitHub OAuth Configuration

### For GitHub OAuth App:

1. Go to GitHub → Settings → Developer settings → OAuth Apps
2. Create a new OAuth App or edit existing one
3. Set:
   - **Application name**: Mivna
   - **Homepage URL**: `https://your-production-domain.com`
   - **Authorization callback URL**: `https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback`
4. Copy Client ID and Client Secret

### In Supabase Dashboard:

1. Go to Authentication → Providers → GitHub
2. Enable GitHub provider
3. Paste Client ID and Client Secret
4. Add required scopes: `repo read:user`

---

## Post-Deployment Checklist

- [ ] Verify environment variables are set correctly
- [ ] Test GitHub OAuth login flow
- [ ] Verify repository connection works
- [ ] Test diagram and README generation
- [ ] Check that the 3-repository limit is enforced
- [ ] Monitor error logs in production

---

## Troubleshooting

### OAuth Login Fails
- Verify the callback URL matches exactly in both GitHub and Supabase
- Check that the GitHub OAuth App is not restricted to specific organizations
- Ensure HTTPS is configured for production

### Loading State Stuck
- Check browser console for errors
- Verify Supabase credentials are correct
- Ensure the Supabase project is active

### Generation Features Not Working
- Verify Supabase Edge Functions are deployed
- Check that the GitHub token has proper scopes
- Monitor Edge Function logs in Supabase dashboard
