# AI Image Create

AI Image Create is a Vite, React, and TypeScript frontend application for AI-assisted ecommerce image generation. It supports single-image generation, batch suite generation, and Smart Layout composition workflows. The app connects to image generation providers such as Volcengine Ark/Seedream and Google Gemini, and uses shadcn/ui, Radix UI, and Tailwind CSS for the interface.

## Core Features

- Single-image generation: generate product scene images, detail images, marketing images, and similar ecommerce assets from prompts and reference images.
- Suite generation: generate multiple related images from reusable templates, suitable for product detail pages, brand showcases, and content expansion.
- Smart Layout: define canvas regions, layers, reference images, and prompts to guide the final image composition.
- Task history: persist generation tasks, results, and failure states with Zustand.

## Tech Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui + Radix UI
- Zustand
- Framer Motion
- Volcengine Ark/Seedream Images API
- Google Gemini API

## Project Structure

```text
.
├── app/                # Frontend application
├── assets/             # Reference images and static assets
├── info/               # Requirements, migration notes, and implementation docs
├── tech-spec.md        # Technical specification
└── README.md           # Project documentation
```

## Getting Started

Install dependencies from the frontend directory:

```bash
cd app
npm install
```

Start the local development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Run lint checks:

```bash
npm run lint
```

## Environment Variables

Create `.env.local` inside the `app/` directory:

```env
VITE_VOLC_API_KEY=your_volc_api_key
VITE_GOOGLE_API_KEY=your_google_api_key
VITE_USE_MOCK=false
```

Notes:

- `VITE_VOLC_API_KEY`: API key for Volcengine Ark/Seedream image generation.
- `VITE_GOOGLE_API_KEY`: API key for Gemini image or vision-related features.
- `VITE_USE_MOCK=true`: enables mock image generation and skips real API requests.

## Main Entry Points

- App entry: `app/src/main.tsx`
- Main page shell: `app/src/App.tsx`
- Image generation API wrapper: `app/src/lib/api.ts`
- Global state store: `app/src/store/appStore.ts`
- Suite generation service: `app/src/services/suiteGenerationService.ts`
- Smart Layout view: `app/src/components/SmartLayoutView.tsx`
- Smart Layout generation logic: `app/src/services/smartLayoutService.ts`
