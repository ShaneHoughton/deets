import fs from "fs";
import { DateTime } from "luxon";
import * as core from "@actions/core";
import * as github from "@actions/github";
import dotenv from "dotenv";
dotenv.config();

const START_DATE = process.env.START_DATE || core.getInput("start-date"); // MM/DD/YYYY
const END_DATE = process.env.END_DATE || core.getInput("end-date"); // MM/DD/YYYY
const TZ = process.env.TZ || core.getInput("timezone"); // e.g., "America/New_York"
const OUTPUT_NAME =
  process.env.OUTPUT_NAME || core.getInput("file-output-name"); // e.g., "CHANGELOG.md"
const GITHUB_TOKEN =
  process.env.GITHUB_TOKEN || core.getInput("github-token", { required: true });
const GH_OWNER = process.env.GH_OWNER || github.context.repo.owner;
const GH_REPO = process.env.GH_REPO || github.context.repo.repo;
const isListElement = (line) => {
  return /^(- |\d+\.\s|[a-zA-Z]\.\s)/.test(line);
};

const createUTCDate = (dateString) => {
  if (!dateString) return DateTime.now().toUTC();
  return DateTime.fromFormat(dateString, "MM/dd/yyyy", {
    zone: TZ,
  }).toUTC();
};

const isBetweenDates = (pr) => {
  let startDate = createUTCDate(START_DATE);
  let endDate = createUTCDate(END_DATE);
  if (!START_DATE) startDate = startDate.minus({ weeks: 1 });
  const mergedDate = DateTime.fromISO(pr.merged_at).toUTC();
  return mergedDate >= startDate && mergedDate <= endDate;
};

const extractContentFromTags = (body, sectionTitle) => {
  const regex = new RegExp(
    `<${sectionTitle}>([\\s\\S]*?)</${sectionTitle}>`,
    "ig"
  );
  const matches = [...body.matchAll(regex)].map((group) => group[1]);
  const sections = matches.map((match) => match.trim().split("\n").filter(line => line.trim() !== ""));
  return sections.flat();
};

const extractDeetsFromBodies = (bodies) => {
  const deets = {
    added: [],
    changed: [],
    fixed: [],
  };
  for (const deet of Object.keys(deets)) {
    console.log(deet);
    const sections = [];
    for (const body of bodies) {
      sections.push(extractContentFromTags(body, deet));
    }
    deets[deet].push(...sections.flat());
  }
  return deets;
};

const writeDeetsTofile = (deets) => {
  const finalLines = [];
  for (const deet of Object.keys(deets)) {
    finalLines.push(`## ${deet}`);
    for (const line of deets[deet]) {
      if (isListElement(line)) {
        finalLines.push(`   ${line}`); // tabbed list element
        continue;
      }
      finalLines.push(`- ${line}`); // normal line
    }
  }

  const filePath = `${OUTPUT_NAME}.md`;
  fs.writeFileSync(filePath, finalLines.join("\n"), "utf-8");
  console.log(`File written to: ${filePath}`);
  return filePath;
};

const main = async () => {
  try {
    const octokit = github.getOctokit(GITHUB_TOKEN);
    const { data } = await octokit.rest.pulls.list({
      owner: GH_OWNER,
      repo: GH_REPO,
      state: "all",
      sort: "long-running",
      per_page: 100,
    });
    const mergedPRs = data.filter(
      (pr) => pr.merged_at !== null && isBetweenDates(pr)
    );
    const PRBodies = mergedPRs.map((pr) => pr.body);
    const deets = extractDeetsFromBodies(PRBodies);
    const filePath = writeDeetsTofile(deets);
    core.info("Changelog generated successfully.");
    core.setOutput("filePath", filePath);
  } catch (error) {
    core.setFailed(error.message);
  }
};

main();
