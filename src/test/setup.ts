import "@testing-library/jest-dom";
import "vitest-axe/extend-expect"; // global TS types for toHaveNoViolations
import { expect } from "vitest";
import * as matchers from "vitest-axe/matchers";

// Register the axe accessibility matcher (`toHaveNoViolations`) globally so any
// test can assert a rendered subtree is free of WCAG violations.
expect.extend(matchers);
