import { describe, expect, it } from "@jest/globals";
import {
  evaluateContributorExperience,
  getExperienceGateDecision,
  isExperienceGateRequired,
  type ContributorExperienceEvidence,
  type StartRequirementSettings,
} from "../src/handlers/shared/contributor-experience";

const gateConfig: StartRequirementSettings = {
  enabled: true,
  gatedLabels: ["Solidity", "Ethereum", "Smart Contract"],
  minimumAccountAgeDays: 90,
  minimumMergedPrs: 2,
  minimumRelevantRepositories: 1,
  relevantRepositoryTopics: ["solidity", "ethereum"],
  bypassUsers: [],
};

describe("contributor experience gate", () => {
  it("does not require experience when no configured gated label is present", () => {
    expect(
      isExperienceGateRequired(
        [
          { name: "Price: 300 USD" },
          { name: "Time: <1 Day" },
        ],
        gateConfig
      )
    ).toBe(false);
  });

  it("requires experience when a configured gated label is present case-insensitively", () => {
    expect(isExperienceGateRequired([{ name: "price: 300 USD" }, { name: "solidity" }], gateConfig)).toBe(true);
  });

  it("passes contributors who satisfy age, merged PR, and relevant repository evidence", () => {
    const evidence: ContributorExperienceEvidence = {
      accountAgeDays: 365,
      mergedPullRequests: 3,
      relevantRepositories: [{ name: "vault", topics: ["solidity"], languages: ["TypeScript"] }],
    };

    expect(evaluateContributorExperience(evidence, gateConfig)).toMatchObject({
      passed: true,
      missingRequirements: [],
    });
  });

  it("rejects gated starts with a clear missing-evidence message", () => {
    const evidence: ContributorExperienceEvidence = {
      accountAgeDays: 7,
      mergedPullRequests: 0,
      relevantRepositories: [],
    };

    expect(evaluateContributorExperience(evidence, gateConfig)).toMatchObject({
      passed: false,
      missingRequirements: [
        "GitHub account must be at least 90 days old",
        "Contributor must have at least 2 merged pull requests",
        "Contributor must have at least 1 public repositories with relevant topics or languages",
      ],
    });
  });

  it("does not count repositories without relevant topics or languages", () => {
    const evidence: ContributorExperienceEvidence = {
      accountAgeDays: 365,
      mergedPullRequests: 3,
      relevantRepositories: [{ name: "portfolio", topics: ["frontend"], languages: ["CSS"] }],
    };

    expect(evaluateContributorExperience(evidence, gateConfig)).toMatchObject({
      passed: false,
      missingRequirements: ["Contributor must have at least 1 public repositories with relevant topics or languages"],
    });
  });

  it("allows configured bypass users without evaluating evidence", () => {
    const decision = getExperienceGateDecision(
      [{ name: "Solidity" }],
      { ...gateConfig, bypassUsers: ["trusted-maintainer"] },
      "trusted-maintainer",
      { accountAgeDays: 0, mergedPullRequests: 0, relevantRepositories: [] }
    );

    expect(decision).toMatchObject({ required: true, passed: true, bypassed: true });
  });
});
