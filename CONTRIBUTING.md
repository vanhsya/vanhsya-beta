# Contributing to VANHSYA Neural Radio Terminal

Thank you for your interest in contributing! This document outlines the process for contributing to the project.

## Development Setup

```bash
git clone https://github.com/vanhsya/vanhsya-beta.git
cd vanhsya-beta
npm install
cp .env.example .env.local
# Add your GEMINI_API_KEY to .env.local
npm run dev
```

## Code Standards

- TypeScript for all source files
- React functional components
- Follow existing code style (Prettier formatted)
- Write self-documenting code with meaningful variable names

## Pull Request Process

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes
4. Ensure all checks pass:
   - `npm run build`
   - `npx tsc --noEmit`
   - `trunk check`
5. Submit a pull request with a clear description

## Coding Guidelines

- Components should be small and focused
- Use Tailwind CSS for styling
- Keep Three.js scene logic in `components/Scene.tsx`
- API and audio logic belongs in `services/`
- Utility functions go in `utils/`

## Testing

Currently, this project does not have automated tests. Manual testing should cover:

- Voice connection establishment
- Mode switching (ECHO/VIGIL)
- Text message sending
- Image enhancement feature
- Offline mode behavior

## Questions?

Open a GitHub discussion or reach out to the maintainers.
