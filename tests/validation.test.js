import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const validationPath = join(process.cwd(), "src", "validation.js");
const validationCode = readFileSync(validationPath, "utf8");

window.eval(`${validationCode}\n//# sourceURL=${pathToFileURL(validationPath).href}`);

const {
  validateTitle,
  validateAmount,
  validateEntry,
  MAX_TITLE_LENGTH,
  MAX_AMOUNT,
} = validationAPI;

describe("validateTitle", () => {
  it("accepts a normal title", () => {
    const result = validateTitle("coffee");

    expect(result.valid).toBe(true);
    expect(result.value).toBe("coffee");
    expect(result.error).toBe("");
  });

  it("trims spaces around the title", () => {
    const result = validateTitle("  salary  ");

    expect(result.valid).toBe(true);
    expect(result.value).toBe("salary");
  });

  it("rejects an empty title", () => {
    const result = validateTitle("");

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Title is required.");
  });

  it("rejects nullish title input as required", () => {
    const result = validateTitle(undefined);

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Title is required.");
  });

  it("rejects a whitespace-only title", () => {
    const result = validateTitle("   ");

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Title is required.");
  });

  it("rejects a title longer than the maximum length", () => {
    const longTitle = "a".repeat(MAX_TITLE_LENGTH + 1);
    const result = validateTitle(longTitle);

    expect(result.valid).toBe(false);
    expect(result.error).toBe(`Title must be ${MAX_TITLE_LENGTH} characters or fewer.`);
  });

  it("accepts non-string title input after converting it to text", () => {
    const result = validateTitle(123);

    expect(result.valid).toBe(true);
    expect(result.value).toBe("123");
  });

  it("accepts a trimmed title at the maximum length boundary", () => {
    const maxLengthTitle = "a".repeat(MAX_TITLE_LENGTH);
    const result = validateTitle(`  ${maxLengthTitle}  `);

    expect(result.valid).toBe(true);
    expect(result.value).toBe(maxLengthTitle);
  });
});

describe("validateAmount", () => {
  it("accepts a valid integer amount", () => {
    const result = validateAmount("100");

    expect(result.valid).toBe(true);
    expect(result.value).toBe(100);
    expect(result.error).toBe("");
  });

  it("accepts a valid amount with two decimal places", () => {
    const result = validateAmount("12.22");

    expect(result.valid).toBe(true);
    expect(result.value).toBe(12.22);
  });

  it("rejects an empty amount", () => {
    const result = validateAmount("");

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Amount is required.");
  });

  it("rejects nullish amount input as required", () => {
    const result = validateAmount(null);

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Amount is required.");
  });

  it("rejects a non-numeric amount", () => {
    const result = validateAmount("abc");

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Amount must be a valid number.");
  });

  it("rejects zero", () => {
    const result = validateAmount("0");

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Amount must be greater than 0.");
  });

  it("rejects negative amounts", () => {
    const result = validateAmount("-80");

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Amount must be greater than 0.");
  });

  it("rejects amounts with more than two decimal places", () => {
    const result = validateAmount("12.222222");

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Amount must use digits only, with at most 2 decimal places.");
  });

  it("rejects scientific notation", () => {
    const result = validateAmount("1e+45");

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Amount must use digits only, with at most 2 decimal places.");
  });

  it("rejects amounts greater than the maximum limit", () => {
    const result = validateAmount(String(MAX_AMOUNT + 1));

    expect(result.valid).toBe(false);
    expect(result.error).toBe(`Amount must not exceed ${MAX_AMOUNT.toLocaleString()}.`);
  });

  it("rejects a whitespace-only amount", () => {
    const result = validateAmount("   ");

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Amount is required.");
  });

  it("accepts currency-like amounts with leading zeros and trailing decimal zeros", () => {
    expect(validateAmount("000.01")).toMatchObject({
      valid: true,
      value: 0.01,
    });
    expect(validateAmount("1.0")).toMatchObject({
      valid: true,
      value: 1,
    });
    expect(validateAmount("1.00")).toMatchObject({
      valid: true,
      value: 1,
    });
    expect(validateAmount("01.05")).toMatchObject({
      valid: true,
      value: 1.05,
    });
  });
});

describe("validateEntry", () => {
  it("accepts a valid title and amount", () => {
    const result = validateEntry("coffee", "12.22");

    expect(result.valid).toBe(true);
    expect(result.value).toEqual({
      title: "coffee",
      amount: 12.22,
    });
    expect(result.errors).toEqual({
      title: "",
      amount: "",
    });
  });

  it("returns both title and amount errors when both inputs are invalid", () => {
    const result = validateEntry("   ", "-80");

    expect(result.valid).toBe(false);
    expect(result.value).toBe(null);
    expect(result.errors.title).toBe("Title is required.");
    expect(result.errors.amount).toBe("Amount must be greater than 0.");
  });

  it("accepts valid title and amount values with surrounding spaces", () => {
    const result = validateEntry("  freelance  ", " 12.50 ");

    expect(result.valid).toBe(true);
    expect(result.value).toEqual({
      title: "freelance",
      amount: 12.5,
    });
  });

  it("returns title length and amount limit errors together", () => {
    const result = validateEntry(
      "a".repeat(MAX_TITLE_LENGTH + 1),
      String(MAX_AMOUNT + 1)
    );

    expect(result.valid).toBe(false);
    expect(result.errors.title).toBe(
      `Title must be ${MAX_TITLE_LENGTH} characters or fewer.`
    );
    expect(result.errors.amount).toBe(
      `Amount must not exceed ${MAX_AMOUNT.toLocaleString()}.`
    );
  });
});
