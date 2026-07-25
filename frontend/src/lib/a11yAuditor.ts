export interface A11yIssue {
  id: string;
  type: "error" | "warning" | "info";
  rule: string;
  message: string;
  elementSnippet?: string;
  suggestion: string;
}

export interface A11yAuditResult {
  score: number; // 0-100
  passedChecks: number;
  totalChecks: number;
  issues: A11yIssue[];
}

export function auditAccessibility(htmlString: string): A11yAuditResult {
  if (!htmlString || !htmlString.trim()) {
    return { score: 100, passedChecks: 0, totalChecks: 0, issues: [] };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");
  const issues: A11yIssue[] = [];

  let checksCount = 0;
  let passedCount = 0;

  function addCheck(passed: boolean, issueIfFailed?: A11yIssue) {
    checksCount++;
    if (passed) {
      passedCount++;
    } else if (issueIfFailed) {
      issues.push(issueIfFailed);
    }
  }

  // 1. Check for <html> lang attribute
  const htmlTag = doc.querySelector("html");
  const hasLang = htmlTag ? Boolean(htmlTag.getAttribute("lang")) : true;
  addCheck(hasLang, {
    id: "html-has-lang",
    type: "warning",
    rule: "WCAG 3.1.1 Language of Page",
    message: "The <html> element is missing a 'lang' attribute (e.g. lang=\"en\").",
    suggestion: 'Add lang="en" to the <html> tag.',
  });

  // 2. Check <img> tags for alt attribute
  const images = Array.from(doc.querySelectorAll("img"));
  images.forEach((img, index) => {
    const hasAlt = img.hasAttribute("alt");
    addCheck(hasAlt, {
      id: `img-alt-${index}`,
      type: "error",
      rule: "WCAG 1.1.1 Non-text Content",
      message: `Image is missing an 'alt' descriptive attribute.`,
      elementSnippet: img.outerHTML.slice(0, 100),
      suggestion: 'Add a descriptive alt attribute, or alt="" if decorative.',
    });
  });

  // 3. Heading hierarchy check (h1 -> h2 -> h3)
  const headings = Array.from(doc.querySelectorAll("h1, h2, h3, h4, h5, h6"));
  const h1Count = doc.querySelectorAll("h1").length;
  addCheck(h1Count > 0, {
    id: "page-has-h1",
    type: "warning",
    rule: "WCAG 1.3.1 Info and Relationships",
    message: "Page is missing a main <h1> heading.",
    suggestion: "Include one primary <h1> element for main title/header.",
  });

  let prevLevel = 0;
  headings.forEach((heading, idx) => {
    const level = parseInt(heading.tagName.replace("H", ""), 10);
    const skipped = prevLevel > 0 && level > prevLevel + 1;
    addCheck(!skipped, {
      id: `heading-hierarchy-${idx}`,
      type: "warning",
      rule: "WCAG 1.3.1 Heading Order",
      message: `Heading hierarchy skips level (from <h${prevLevel}> to <h${level}>).`,
      elementSnippet: heading.outerHTML.slice(0, 100),
      suggestion: `Use continuous heading levels (e.g. <h${prevLevel + 1}> before <h${level}>).`,
    });
    prevLevel = level;
  });

  // 4. Check form controls for labels
  const inputs = Array.from(doc.querySelectorAll("input, select, textarea"));
  inputs.forEach((input, index) => {
    const inputType = input.getAttribute("type");
    if (inputType === "hidden" || inputType === "submit" || inputType === "button") return;

    const id = input.getAttribute("id");
    const hasLabel =
      (id && doc.querySelector(`label[for="${id}"]`)) ||
      input.closest("label") ||
      input.hasAttribute("aria-label") ||
      input.hasAttribute("aria-labelledby") ||
      input.getAttribute("placeholder");

    addCheck(Boolean(hasLabel), {
      id: `input-label-${index}`,
      type: "error",
      rule: "WCAG 4.1.2 Name, Role, Value",
      message: "Form control has no associated <label> or aria-label.",
      elementSnippet: input.outerHTML.slice(0, 100),
      suggestion: 'Provide an aria-label="Name" or link with <label for="...">.',
    });
  });

  // 5. Check buttons for accessible text
  const buttons = Array.from(doc.querySelectorAll("button, a[role='button']"));
  buttons.forEach((btn, index) => {
    const text = btn.textContent?.trim();
    const hasAria = btn.hasAttribute("aria-label") || btn.hasAttribute("aria-labelledby");
    const hasAccessibleName = Boolean(text || hasAria || btn.querySelector("img[alt], svg title"));

    addCheck(hasAccessibleName, {
      id: `button-name-${index}`,
      type: "error",
      rule: "WCAG 4.1.2 Button Name",
      message: "Button element has no accessible text label or icon title.",
      elementSnippet: btn.outerHTML.slice(0, 100),
      suggestion: 'Add text content or an aria-label="Describe action" to the button.',
    });
  });

  // 6. Check interactive non-semantic elements (div with onclick missing role)
  const interactiveDivs = Array.from(doc.querySelectorAll("div[onclick], span[onclick]"));
  interactiveDivs.forEach((div, index) => {
    const hasRole = div.hasAttribute("role");
    const hasTabindex = div.hasAttribute("tabindex");

    addCheck(hasRole && hasTabindex, {
      id: `interactive-div-${index}`,
      type: "warning",
      rule: "WCAG 2.1.1 Keyboard Accessible",
      message: "Non-semantic element (<div>/<span>) has a click handler without keyboard role/tabindex.",
      elementSnippet: div.outerHTML.slice(0, 100),
      suggestion: 'Use a standard <button> element or add role="button" tabindex="0".',
    });
  });

  // Calculate score
  const total = Math.max(1, checksCount);
  const score = Math.round((passedCount / total) * 100);

  return {
    score,
    passedChecks: passedCount,
    totalChecks: checksCount,
    issues,
  };
}
