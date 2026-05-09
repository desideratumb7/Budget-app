import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

function evalSourceFile(window, filePath, code) {
  window.eval(`${code}\n//# sourceURL=${pathToFileURL(filePath).href}`);
}

function loadApp(setup) {
  const html = readFileSync(join(projectRoot, "index.html"), "utf8");

  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    url: "http://localhost/",
  });

  const { window } = dom;

  // jsdom does not fully implement canvas, so we mock the methods used by chart.js.
  window.HTMLCanvasElement.prototype.getContext = () => ({
    lineWidth: 0,
    strokeStyle: "",
    beginPath() {},
    arc() {},
    stroke() {},
    clearRect() {},
  });

  window.localStorage.clear();
  setup?.(window);

  const validationPath = join(projectRoot, "src", "validation.js");
  const chartPath = join(projectRoot, "chart.js");
  const budgetPath = join(projectRoot, "budget.js");

  const validationCode = readFileSync(validationPath, "utf8");
  const chartCode = readFileSync(chartPath, "utf8");
  const budgetCode = readFileSync(budgetPath, "utf8");

  evalSourceFile(window, validationPath, validationCode);
  evalSourceFile(window, chartPath, chartCode);
  evalSourceFile(window, budgetPath, budgetCode);

  return {
    window,
    document: window.document,
    close: () => window.close(),
  };
}

function getStoredEntries(window) {
  return JSON.parse(window.localStorage.getItem("entry_list") || "[]");
}

function setInput(document, selector, value) {
  document.querySelector(selector).value = value;
}

function addExpenseEntry(document, title, amount) {
  setInput(document, "#expense-title-input", title);
  setInput(document, "#expense-amount-input", amount);
  document.querySelector(".add-expense").click();
}

function addIncomeEntry(document, title, amount) {
  setInput(document, "#income-title-input", title);
  setInput(document, "#income-amount-input", amount);
  document.querySelector(".add-income").click();
}

describe("Budget app DOM validation", () => {
  it("blocks a negative expense amount and shows an error message", () => {
    const app = loadApp();
    const { window, document } = app;

    setInput(document, "#expense-title-input", "coffee");
    setInput(document, "#expense-amount-input", "-80");

    document.querySelector(".add-expense").click();

    expect(document.querySelector("#expense-amount-error").textContent).toBe(
      "Amount must be greater than 0."
    );
    expect(getStoredEntries(window)).toHaveLength(0);

    app.close();
  });

  it("blocks a whitespace-only expense title and shows an error message", () => {
    const app = loadApp();
    const { window, document } = app;

    setInput(document, "#expense-title-input", "   ");
    setInput(document, "#expense-amount-input", "11");

    document.querySelector(".add-expense").click();

    expect(document.querySelector("#expense-title-error").textContent).toBe(
      "Title is required."
    );
    expect(getStoredEntries(window)).toHaveLength(0);

    app.close();
  });

  it("blocks an expense amount above the maximum limit", () => {
    const app = loadApp();
    const { window, document } = app;

    setInput(document, "#expense-title-input", "rent");
    setInput(document, "#expense-amount-input", "1000000001");

    document.querySelector(".add-expense").click();

    expect(document.querySelector("#expense-amount-error").textContent).toBe(
      "Amount must not exceed 1,000,000,000."
    );
    expect(getStoredEntries(window)).toHaveLength(0);

    app.close();
  });

  it("adds a valid expense, trims the title, and clears error messages", () => {
    const app = loadApp();
    const { window, document } = app;

    // First submit invalid input to create an error message.
    setInput(document, "#expense-title-input", "coffee");
    setInput(document, "#expense-amount-input", "-80");
    document.querySelector(".add-expense").click();

    expect(document.querySelector("#expense-amount-error").textContent).toBe(
      "Amount must be greater than 0."
    );

    // Then submit valid input.
    setInput(document, "#expense-title-input", "  coffee  ");
    setInput(document, "#expense-amount-input", "12.22");
    document.querySelector(".add-expense").click();

    const entries = getStoredEntries(window);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      type: "expense",
      title: "coffee",
      amount: 12.22,
    });

    expect(document.querySelector("#expense-title-error").textContent).toBe("");
    expect(document.querySelector("#expense-amount-error").textContent).toBe("");
    expect(document.querySelector("#expense .list").textContent).toContain(
      "coffee"
    );
    expect(document.querySelector(".outcome-total").textContent).toContain(
      "$12.22"
    );

    app.close();
  });

  it("adds a valid income entry", () => {
    const app = loadApp();
    const { window, document } = app;

    setInput(document, "#income-title-input", "salary");
    setInput(document, "#income-amount-input", "1000");

    document.querySelector(".add-income").click();

    const entries = getStoredEntries(window);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      type: "income",
      title: "salary",
      amount: 1000,
    });

    expect(document.querySelector("#income-title-error").textContent).toBe("");
    expect(document.querySelector("#income-amount-error").textContent).toBe("");
    expect(document.querySelector("#income .list").textContent).toContain(
      "salary"
    );
    expect(document.querySelector(".income-total").textContent).toContain(
      "$1000"
    );

    app.close();
  });
});

describe("Budget app interactions", () => {
  it("deletes an entry and removes it from localStorage and the list", () => {
    const app = loadApp();
    const { window, document } = app;

    addIncomeEntry(document, "bonus", "250");

    expect(getStoredEntries(window)).toHaveLength(1);
    expect(document.querySelector("#income .list").textContent).toContain(
      "bonus"
    );

    document.querySelector("#income .delete").click();

    expect(getStoredEntries(window)).toEqual([]);
    expect(document.querySelector("#income .list").textContent).not.toContain(
      "bonus"
    );

    app.close();
  });

  it("copies an expense into the inputs before removing it for editing", () => {
    const app = loadApp();
    const { window, document } = app;

    addExpenseEntry(document, "groceries", "44.5");

    document.querySelector("#expense .edit").click();

    expect(document.querySelector("#expense-title-input").value).toBe(
      "groceries"
    );
    expect(document.querySelector("#expense-amount-input").value).toBe("44.5");
    expect(getStoredEntries(window)).toEqual([]);

    app.close();
  });

  it("stores rejected cookie consent and hides the cookie banner", () => {
    const app = loadApp();
    const { window, document } = app;

    expect(window.localStorage.getItem("cookie_consent")).toBe(null);

    document.querySelector("#reject-cookies").click();

    expect(window.localStorage.getItem("cookie_consent")).toBe("rejected");
    expect(document.querySelector("#cookie-banner").classList.contains("hide")).toBe(
      true
    );

    app.close();
  });

  it("stores necessary-only cookie consent and hides the cookie banner", () => {
    const app = loadApp();
    const { window, document } = app;

    document.querySelector("#necessary-cookies").click();

    expect(window.localStorage.getItem("cookie_consent")).toBe(
      "necessary_only"
    );
    expect(document.querySelector("#cookie-banner").classList.contains("hide")).toBe(
      true
    );

    app.close();
  });

  it("stores accepted cookie consent and hides the cookie banner", () => {
    const app = loadApp();
    const { window, document } = app;

    document.querySelector("#accept-cookies").click();

    expect(window.localStorage.getItem("cookie_consent")).toBe("accepted_all");
    expect(document.querySelector("#cookie-banner").classList.contains("hide")).toBe(
      true
    );

    app.close();
  });

  it("hides the cookie banner on startup when consent already exists", () => {
    const app = loadApp((window) => {
      window.localStorage.setItem("cookie_consent", "accepted_all");
    });
    const { document } = app;

    expect(document.querySelector("#cookie-banner").classList.contains("hide")).toBe(
      true
    );

    app.close();
  });

  it("renders valid stored entries and updates totals on startup", () => {
    const app = loadApp((window) => {
      window.localStorage.setItem(
        "entry_list",
        JSON.stringify([
          { type: "income", title: "Salary", amount: 1000 },
          { type: "expense", title: "Rent", amount: 300 },
        ])
      );
    });
    const { document } = app;

    expect(document.querySelector("#income .list").textContent).toContain(
      "Salary"
    );
    expect(document.querySelector("#expense .list").textContent).toContain(
      "Rent"
    );
    expect(document.querySelector(".income-total").textContent).toContain(
      "$1000"
    );
    expect(document.querySelector(".outcome-total").textContent).toContain(
      "$300"
    );

    app.close();
  });

  it("filters invalid stored entries and renders only valid entries", () => {
    const app = loadApp((window) => {
      window.localStorage.setItem(
        "entry_list",
        JSON.stringify([
          { type: "bad", title: "Invalid", amount: 10 },
          { type: "income", title: "Valid Salary", amount: 1000 },
        ])
      );
    });
    const { window, document } = app;

    expect(getStoredEntries(window)).toEqual([
      { type: "income", title: "Valid Salary", amount: 1000 },
    ]);
    expect(document.querySelector("#income .list").textContent).toContain(
      "Valid Salary"
    );
    expect(document.querySelector("#all .list").textContent).not.toContain(
      "Invalid"
    );

    app.close();
  });

  it("switches between expense, income, and all tabs", () => {
    const app = loadApp();
    const { document } = app;

    document.querySelector(".first-tab").click();

    expect(document.querySelector("#expense").classList.contains("hide")).toBe(
      false
    );
    expect(document.querySelector("#income").classList.contains("hide")).toBe(
      true
    );
    expect(document.querySelector(".first-tab").classList.contains("focus")).toBe(
      true
    );

    document.querySelector(".second-tab").click();

    expect(document.querySelector("#income").classList.contains("hide")).toBe(
      false
    );
    expect(document.querySelector("#expense").classList.contains("hide")).toBe(
      true
    );
    expect(document.querySelector(".second-tab").classList.contains("focus")).toBe(
      true
    );

    document.querySelector(".third-tab").click();

    expect(document.querySelector("#all").classList.contains("hide")).toBe(false);
    expect(document.querySelector("#income").classList.contains("hide")).toBe(
      true
    );
    expect(document.querySelector(".third-tab").classList.contains("focus")).toBe(
      true
    );

    app.close();
  });

  it("blocks invalid income input and displays validation messages", () => {
    const app = loadApp();
    const { window, document } = app;

    addIncomeEntry(document, "", "0");

    expect(document.querySelector("#income-title-error").textContent).toBe(
      "Title is required."
    );
    expect(document.querySelector("#income-amount-error").textContent).toBe(
      "Amount must be greater than 0."
    );
    expect(getStoredEntries(window)).toEqual([]);

    app.close();
  });

  it("copies an income entry into the inputs before removing it for editing", () => {
    const app = loadApp();
    const { window, document } = app;

    addIncomeEntry(document, "freelance", "700");

    document.querySelector("#income .edit").click();

    expect(document.querySelector("#income-title-input").value).toBe(
      "freelance"
    );
    expect(document.querySelector("#income-amount-input").value).toBe("700");
    expect(getStoredEntries(window)).toEqual([]);

    app.close();
  });

  it("ignores list clicks and malformed action buttons", () => {
    const app = loadApp();
    const { window, document } = app;

    addExpenseEntry(document, "coffee", "5");

    document.querySelector("#expense .list").click();

    const orphanButton = document.createElement("button");
    orphanButton.dataset.action = "delete";
    document.querySelector("#expense .list").append(orphanButton);
    orphanButton.click();

    const unknownActionButton = document.createElement("button");
    unknownActionButton.dataset.action = "archive";
    const unknownActionItem = document.createElement("li");
    unknownActionItem.dataset.index = "0";
    unknownActionItem.append(unknownActionButton);
    document.querySelector("#expense .list").append(unknownActionItem);
    unknownActionButton.click();

    expect(getStoredEntries(window)).toHaveLength(1);

    app.close();
  });

  it("ignores delete and edit actions with invalid or missing indexes", () => {
    const app = loadApp();
    const { window, document } = app;

    addExpenseEntry(document, "tea", "4");

    const deleteItem = document.querySelector("#expense li");
    deleteItem.dataset.index = "bad";
    deleteItem.querySelector(".delete").click();

    const editItem = document.querySelector("#expense li");
    editItem.dataset.index = "bad";
    editItem.querySelector(".edit").click();

    editItem.dataset.index = "9";
    editItem.querySelector(".edit").click();

    expect(getStoredEntries(window)).toEqual([
      { type: "expense", title: "tea", amount: 4 },
    ]);

    app.close();
  });

  it("removes non-array stored entry data on startup", () => {
    const app = loadApp((window) => {
      window.localStorage.setItem("entry_list", JSON.stringify({ bad: true }));
    });
    const { window, document } = app;

    expect(getStoredEntries(window)).toEqual([]);
    expect(document.querySelector("#all .list").textContent).toBe("");

    app.close();
  });

  it("recovers from malformed stored entry JSON on startup", () => {
    const app = loadApp((window) => {
      window.console.error = () => {};
      window.localStorage.setItem("entry_list", "{not-valid-json");
    });
    const { window, document } = app;

    expect(getStoredEntries(window)).toEqual([]);
    expect(document.querySelector("#all .list").textContent).toBe("");

    app.close();
  });

  it("keeps working when cookie banner elements are missing", () => {
    const app = loadApp((window) => {
      window.document.querySelector("#cookie-banner").remove();
    });
    const { document } = app;

    expect(document.querySelector("#cookie-banner")).toBe(null);

    app.close();
  });

  it("saves consent without a banner when a consent button remains", () => {
    const app = loadApp((window) => {
      const banner = window.document.querySelector("#cookie-banner");
      const acceptButton = window.document.querySelector("#accept-cookies");
      window.document.body.append(acceptButton);
      banner.remove();
    });
    const { window, document } = app;

    document.querySelector("#accept-cookies").click();

    expect(window.localStorage.getItem("cookie_consent")).toBe("accepted_all");
    expect(document.querySelector("#cookie-banner")).toBe(null);

    app.close();
  });

  it("applies language changes and refreshes visible validation errors", () => {
    const app = loadApp();
    const { window, document } = app;

    addExpenseEntry(document, "", "0");

    expect(document.querySelector("#expense-title-error").textContent).toBe(
      "Title is required."
    );

    document.querySelector("#lang-toggle").click();

    expect(window.localStorage.getItem("lang")).toBe("zh");
    expect(document.querySelector("#expense-title-error").textContent).not.toBe(
      "Title is required."
    );

    app.close();
  });

  it("refreshes income validation errors when the language changes", () => {
    const app = loadApp();
    const { window, document } = app;

    addIncomeEntry(document, "", "0");
    document.querySelector("#lang-toggle").click();

    expect(window.localStorage.getItem("lang")).toBe("zh");
    expect(document.querySelector("#income-title-error").textContent).not.toBe(
      "Title is required."
    );

    app.close();
  });

  it("keeps loading when optional language controls are missing", () => {
    const app = loadApp((window) => {
      window.document.querySelector("#lang-toggle").remove();
    });
    const { document } = app;

    expect(document.querySelector("#lang-toggle")).toBe(null);
    expect(document.querySelector(".balance .title").textContent).toBe("Balance");

    app.close();
  });

  it("skips unknown translation keys", () => {
    const app = loadApp((window) => {
      window.document.querySelector("[data-i18n]").dataset.i18n = "missing";
      window.document.querySelector("[data-i18n-placeholder]").dataset.i18nPlaceholder =
        "missing";
      window.document.querySelector("[data-i18n-aria]").dataset.i18nAria =
        "missing";
    });
    const { document } = app;

    expect(document.querySelector("[data-i18n]").textContent).toBe("Balance");
    expect(document.querySelector("[data-i18n-placeholder]").placeholder).toBe(
      "title"
    );
    expect(document.querySelector("[data-i18n-aria]").getAttribute("aria-label")).toBe(
      "Add expense"
    );

    app.close();
  });

  it("continues when saving entries fails", () => {
    const app = loadApp();
    const { window, document } = app;
    const originalSetItem = window.Storage.prototype.setItem;
    const originalConsoleError = window.console.error;
    const errors = [];

    window.Storage.prototype.setItem = function () {
      throw new Error("storage unavailable");
    };
    window.console.error = (...args) => {
      errors.push(args);
    };

    addExpenseEntry(document, "parking", "9");

    expect(document.querySelector("#expense .list").textContent).toContain(
      "parking"
    );
    expect(errors).toHaveLength(1);

    window.Storage.prototype.setItem = originalSetItem;
    window.console.error = originalConsoleError;
    app.close();
  });
});
