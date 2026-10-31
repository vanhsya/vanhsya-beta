.PHONY: install dev build preview typecheck lint clean deploy help

# Default target
help:
	@echo "VANHSYA Neural Radio Terminal - Available Commands"
	@echo ""
	@echo "  make install    Install dependencies"
	@echo "  make dev        Start development server"
	@echo "  make build      Build production bundle"
	@echo "  make preview    Preview production build locally"
	@echo "  make typecheck  Run TypeScript type checking"
	@echo "  make lint       Run linter (Trunk)"
	@echo "  make clean      Remove build artifacts and node_modules"
	@echo "  make deploy     Deploy to production (Netlify)"
	@echo "  make help       Show this help message"

install:
	npm install

dev:
	npm run dev

build:
	npm run build

preview:
	npm run preview

typecheck:
	npx tsc --noEmit

lint:
	trunk check

clean:
	rm -rf dist node_modules
	@echo "Cleaned build artifacts and node_modules"

deploy: build
	@echo "Build complete. Upload the 'dist' folder to your hosting provider."
	@echo "See ENVIRONMENT.md for deployment instructions."