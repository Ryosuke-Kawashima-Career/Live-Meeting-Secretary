# Implementation Plan - Multi-Language Expansion Support

This document outlines the proposed changes to expand the Live Translation AI (Live Meeting Secretary) to support five additional Indian languages alongside English and Japanese:
- **Hindi (HI)**
- **Bengali (BN)**
- **Marathi (MR)**
- **Telugu (TE)**
- **Tamil (TA)**

---

## Proposed Changes

We will modify the frontend configuration dropdowns and the backend agent prompt compiler to dynamically support the expanded set of 7 languages.

### 1. Frontend Configuration Dropdowns

#### [MODIFY] [index.html](file:///d:/adventure/Projects/Live-Meeting-Secretary/app/static/index.html)
Add options for the 5 new languages to both the `Translate From` (`#selectFrom`) and `Translate To` (`#selectTo`) elements.

```html
<!-- From Select Dropdown -->
<select id="selectFrom" class="glass-select">
  <option value="auto" selected>Auto-Detect</option>
  <option value="en">English (EN)</option>
  <option value="ja">Japanese (JA)</option>
  <option value="hi">Hindi (HI)</option>
  <option value="bn">Bengali (BN)</option>
  <option value="mr">Marathi (MR)</option>
  <option value="te">Telugu (TE)</option>
  <option value="ta">Tamil (TA)</option>
</select>

<!-- To Select Dropdown -->
<select id="selectTo" class="glass-select">
  <option value="ja" selected>Japanese (JA)</option>
  <option value="en">English (EN)</option>
  <option value="hi">Hindi (HI)</option>
  <option value="bn">Bengali (BN)</option>
  <option value="mr">Marathi (MR)</option>
  <option value="te">Telugu (TE)</option>
  <option value="ta">Tamil (TA)</option>
</select>
```

---

### 2. Backend Prompt Generalization

#### [MODIFY] [agent.py](file:///d:/adventure/Projects/Live-Meeting-Secretary/app/my_agent/agent.py)
Generalize the dynamic system prompt compiler (`get_agent_instruction`) to support all 7 languages robustly:

*   Define a mapping dictionary `LANGUAGES` to convert ISO-639-1 language codes into full language names.
*   **Auto-Detect (`from_lang == "auto"`)**: Instruction directs the agent to detect any of the 7 languages and translate them to the selected `to_lang`. If the speaker already speaks the target language `to_lang`, the agent will translate it into English (or Japanese if the target is English).
*   **Explicit Pair**: Instruction directs the agent to translate specifically from `from_lang` to `to_lang`.

```python
LANGUAGES = {
    "en": "English",
    "ja": "Japanese",
    "hi": "Hindi",
    "bn": "Bengali",
    "mr": "Marathi",
    "te": "Telugu",
    "ta": "Tamil",
}
```

---

## Open Questions

> [!IMPORTANT]
> **Q1: Fallback logic for Auto-Detect of Target Language**
> In auto-detection mode, if a speaker speaks the target language itself, the system translates it to a default fallback language. Currently, this plan maps that fallback to English (or Japanese if target is English). Is this fallback pair setting acceptable, or is there another preferred fallback language?

---

## Verification Plan

### Automated Check
- Validate compile safety:
  ```bash
  python -m py_compile app/main.py app/my_agent/agent.py
  ```

### Manual Steps
1. Launch server: `python -m uvicorn app.main:app --port 8000`.
2. Access `http://localhost:8000`. Verify the dropdown menus display all 7 language options.
3. Select `Translate From: English` and `Translate To: Hindi`, toggle `Bilingual Mode`.
4. Verify websocket connection handshakes succeed with `from_lang=en&to_lang=hi`.
