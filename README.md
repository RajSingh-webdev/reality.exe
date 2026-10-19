# Reality.exe — An Interactive Universe Sandbox

Reality.exe is an interactive 3D programmable universe and deterministic N-body physics engine built with React 19, Three.js / React Three Fiber, Lenis smooth scrolling, and Tailwind CSS.

---

## Feedback Channel & Web3Forms Integration

The landing page features a dedicated **Feedback Channel** allowing users to submit bug reports, feature requests, and general suggestions directly to your email inbox via [Web3Forms](https://web3forms.com/).

### Setup Instructions

1. **Create a Web3Forms account** (or request a key directly).
2. **Obtain an access key** from [https://web3forms.com/](https://web3forms.com/).
3. **Add the key to your local `.env` file**:
   ```bash
   VITE_WEB3FORMS_ACCESS_KEY=your_actual_access_key
   ```
   *(You can copy `.env.example` to `.env` as a starting template)*.
4. **Restart the Vite development server**:
   ```bash
   npm run dev
   ```
5. **For Netlify deployment**, add `VITE_WEB3FORMS_ACCESS_KEY` under:
   **Site configuration** → **Environment variables** → **Add a variable**
   - **Key**: `VITE_WEB3FORMS_ACCESS_KEY`
   - **Value**: `your_actual_access_key`
6. **Redeploy the site** after configuring the environment variable so Vite can embed the variable during the production build.
7. **Submit a test message** from the live site's Feedback section and confirm that the transmission arrives at the email address associated with your Web3Forms account.

> **Note**: Do not hardcode or commit your actual access key to source control. The `.env` file is already listed in `.gitignore`.

---

## Development

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Run TypeScript type check
npx tsc --noEmit

# Build production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## Architecture Overview

- **Landing Experience**: Multi-layered cinematic scroll-driven reveal (Earthrise, Mission Log reel, Trajectory plotting, System tiers, Feedback channel).
- **Physics Engine**: Deterministic Newtonian gravitational simulation running at 120Hz with variable mass, black holes, relativistic orbital perturbations, and matter disintegration.
- **Controls & Telemetry**: Natural language command console, dynamic camera tracking, time dilation, and impulse vectors.
