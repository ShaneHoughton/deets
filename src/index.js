import fs from "fs";
import { DateTime } from "luxon";
import * as core from "@actions/core";
import * as github from "@actions/github";
import dotenv from "dotenv";
dotenv.config();

const DAYS_BACK = process.env.DAYS_BACK || core.getInput("days-back") || 14;
const DATE_RANGE = process.env.DATE_RANGE || core.getInput("date-range");
const TZ = process.env.TZ || core.getInput("timezone");
const OUTPUT_NAME = process.env.OUTPUT_NAME || core.getInput("md-output-name");
const GITHUB_TOKEN =
  process.env.GITHUB_TOKEN || core.getInput("github-token", { required: true });
const GH_OWNER = process.env.GH_OWNER || github.context.repo.owner;
const GH_REPO = process.env.GH_REPO || github.context.repo.repo;

// regex
const isListElement = (line) => {
  return /^(- |\d+\.\s|[a-zA-Z]\.\s)/.test(line);
};

// dealing with dates
let startDate = null;
let endDate = null;

const setupDates = () => {
  if (DATE_RANGE) {
    const [start, end] = DATE_RANGE.split("-").map((dateStr) => dateStr.trim());
    startDate = createUTCDate(start);
    endDate = createUTCDate(end);
    return;
  }
  console.log('no date range', DAYS_BACK)
  if (DAYS_BACK > 0) startDate = createUTCDate().minus({ days: DAYS_BACK });
  else startDate = createUTCDate();
};

const isBetweenDates = (pr) => {
  const mergedDate = DateTime.fromISO(pr.merged_at).toUTC();
  if (DATE_RANGE && endDate) {
    return mergedDate >= startDate && mergedDate <= endDate;
  }
  return mergedDate >= startDate;
};

const createUTCDate = (dateString) => {
  if (!dateString) return DateTime.now().toUTC(); // returns today's date
  return DateTime.fromFormat(dateString, "MM/dd/yyyy", {
    zone: TZ,
  }).toUTC();
};

// extracting details
const extractContentFromTags = (body, sectionTitle) => {
  const regex = new RegExp(
    `<${sectionTitle}>([\\s\\S]*?)</${sectionTitle}>`,
    "ig"
  );
  const matches = [...body.matchAll(regex)].map((group) => group[1]);
  const sections = matches.map((match) =>
    match
      .trim()
      .split("\n")
      .filter((line) => line.trim() !== "")
  );
  return sections.flat();
};

const extractDeetsFromPRs = (PRs) => {
  const deets = {
    added: [],
    changed: [],
    fixed: [],
  };
  for (const deet of Object.keys(deets)) {
    core.info(`Seeing what was ${deet}...`);
    const sections = [];
    for (const pr of PRs) {
      const { body, title, url } = pr;
      const content = extractContentFromTags(body, deet);
      if (content.length === 0) continue;
      sections.push(`#### [${title}](${url})`);
      sections.push(content);
    }
    deets[deet].push(...sections.flat());
  }
  return deets;
};

// file writing
const writeDeetsTofile = (deets) => {
  const finalLines = [];
  for (const deet of Object.keys(deets)) {
    finalLines.push(`## ${deet}`);
    for (const line of deets[deet]) {
      if (line[0] === "#") {
        // heading line
        finalLines.push(`\n${line}`);
        continue;
      }
      if (isListElement(line)) {
        // tabbed list element
        finalLines.push(`   ${line}`);
        continue;
      }
      // normal line
      finalLines.push(`- ${line}`);
    }
    finalLines.push("\n");
  }

  const filePath = `${OUTPUT_NAME}.md`;
  fs.writeFileSync(filePath, finalLines.join("\n"), "utf-8");
  core.info(`File written to: ${filePath}`);
  return filePath;
};


// main logic
const main = async () => {
  setupDates();
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
    const PRInfo = mergedPRs.map((pr) => ({
      body: pr.body,
      title: pr.title,
      url: pr.html_url,
    }));
    const deets = extractDeetsFromPRs(PRInfo);
    const filePath = writeDeetsTofile(deets);
    core.info("Got the deets.");
    core.setOutput("filePath", filePath);
  } catch (error) {
    core.setFailed(error.message);
  }
};

main();
