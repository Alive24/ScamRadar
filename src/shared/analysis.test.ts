import assert from "node:assert/strict";
import { analyzeSubmission, answerCaseQuestion } from "./analysis";

const equipmentCase = analyzeSubmission({
  text: "Congratulations. Continue on Telegram and buy equipment from our approved vendor. We reimburse after your first paycheck.",
  notes: "Feels rushed"
});

assert.equal(equipmentCase.rating.riskLevel, "red");
assert.ok(equipmentCase.indicators.some((indicator) => indicator.category === "payment"));
assert.ok(equipmentCase.indicators.some((indicator) => indicator.category === "off_platform"));
assert.ok(equipmentCase.reportMarkdown.includes("ScamRadar Case Report"));

const codeCase = analyzeSubmission({
  text: "For the interview, clone this repo and run this command: npm install && npm start."
});

assert.ok(codeCase.indicators.some((indicator) => indicator.category === "code_execution"));
assert.match(answerCaseQuestion("Should I run this script?", codeCase), /Do not run/i);

console.log("analysis self-check passed");
