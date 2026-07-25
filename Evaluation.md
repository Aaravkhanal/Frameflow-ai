# 📊 FrameFlow AI Model & Evaluation Benchmarks

**Created & Engineered by Aarav Khanal**

FrameFlow AI provides built-in benchmarking utilities to evaluate multi-model AI consensus and vision models (GPT-5.5, Claude Opus, Gemini 3.1 Pro) across UI screenshots.

---

## 🏃 Running Evaluation Benchmarks

1. Place input screenshots in `backend/evals_data/inputs`.
2. Configure your evaluation stack (`STACK` and `MODEL`) in `backend/evals/config.py`.
3. Run the evaluation suite:
   ```bash
   cd backend
   poetry run python run_evals.py
   ```
4. Output HTML artifacts will be generated in `backend/evals_data/outputs`.

---

## ⭐️ Rating Evaluation Outputs

Access the live evaluation scoring studio in the browser:

```text
http://localhost:5173/evals
```

Scores are evaluated across layout accuracy, visual styling fidelity, and code clean-ness on a scale of 1-4.

---

<div align="center">

Developed by **[Aarav Khanal](https://github.com/aaravkhanal)**

</div>
