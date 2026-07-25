# 🛠️ FrameFlow AI Troubleshooting Guide

**Created & Engineered by Aarav Khanal**

If you encounter issues configuring API keys or running FrameFlow AI, follow these solutions.

---

## 🔑 1. Obtaining & Setting API Keys

FrameFlow AI supports **OpenAI, Anthropic Claude, and Google Gemini** models. At minimum, one valid API key is required to generate code.

### OpenAI API Key Setup

1. Log into your [OpenAI Platform Dashboard](https://platform.openai.com/).
2. Navigate to **Settings > Billing** and ensure you have active credits (minimum $5 purchase).
3. Verify under **Settings > Limits** that your account is at **Tier 1** or higher for GPT-4/GPT-5 vision access.
4. Go to [OpenAI API Keys](https://platform.openai.com/api-keys) and generate a new secret key.
5. In FrameFlow AI, click the **Settings** gear icon and paste your key under **OpenAI API Key**, or add it to `backend/.env`.

### Anthropic Claude API Key Setup

1. Log into the [Anthropic Console](https://console.anthropic.com/).
2. Add credit balance under **Plans & Billing**.
3. Generate an API key under **API Keys**.
4. Add `ANTHROPIC_API_KEY=your_key` in `backend/.env` or in the FrameFlow AI Settings dialog.

### Google Gemini API Key Setup

1. Visit [Google AI Studio](https://aistudio.google.com/).
2. Click **Create API Key**.
3. Add `GEMINI_API_KEY=your_key` in `backend/.env` or in the FrameFlow AI Settings dialog.

---

## ❓ 2. Common Issues & Resolution

### "API Rate Limit or Quota Exceeded (429)"
- Check your provider billing plan (e.g. OpenAI or Anthropic credits).
- Switch to another model in FrameFlow AI Settings (e.g., Gemini 3 Flash).

### "No OpenAI, Anthropic, or Gemini API key set"
- Ensure at least one key is present in `backend/.env` or typed into the Settings dialog in the UI.
- Restart the backend server after editing `backend/.env`.

---

<div align="center">

Developed by **[Aarav Khanal](https://github.com/aaravkhanal)**

</div>
