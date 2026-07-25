# 🧪 FrameFlow AI Testing Guide

**Created & Engineered by Aarav Khanal**

This guide outlines the testing suite and practices for the **FrameFlow AI** platform.

---

## 🛠️ Backend Automated Tests

The backend uses `pytest` with 228 automated unit and integration tests located in `backend/tests/`.

### Prerequisites

Ensure backend Poetry dependencies are installed:

```bash
cd backend
poetry install
```

### Running Tests

#### Run all 228 backend tests:
```bash
cd backend
poetry run pytest
```

#### Run tests with verbose output:
```bash
poetry run pytest -vv
```

#### Run type checking (`pyright`):
```bash
poetry run pyright
```

---

## 💻 Frontend Verification

```bash
cd frontend
pnpm lint
./node_modules/.bin/tsc --noEmit
pnpm build
```

---

<div align="center">

Developed by **[Aarav Khanal](https://github.com/aaravkhanal)**

</div>
