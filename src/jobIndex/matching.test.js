import assert from "node:assert/strict";
import { matchesQueryIntent } from "./utils.js";

const cases = [
  ["software engineer", "Security Engineer", false],
  ["software engineer", "Software Engineer, Full Stack", true],
  ["software engineer intern", "Software Engineer Intern", true],
  ["software engineer intern", "Software Engineer", false],
  ["product manager", "Engineering Manager", false],
  ["product manager", "Product Marketing Manager", false],
  ["product manager", "Manager, Data Science - AI Product", false],
  ["product manager", "Product Manager", true],
  ["data analyst", "Business Analyst", false],
  ["data analyst", "Data Analyst", true]
];

for (const [targetTitle, title, expected] of cases) {
  assert.equal(
    matchesQueryIntent(
      { title, location: "United States", description: "Responsibilities qualifications apply." },
      { targetTitle, location: "United States" }
    ),
    expected,
    `${targetTitle} should ${expected ? "" : "not "}match ${title}`
  );
}

console.log("Job title matcher regression tests passed.");
