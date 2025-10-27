import fs from "fs";
import { DateTime } from "luxon";
import * as core from "@actions/core";
import * as github from "@actions/github";

const START_DATE = core.getInput("start-date"); // MM/DD/YYYY
const END_DATE = core.getInput("end-date"); // MM/DD/YYYY
const TZ = core.getInput("timezone"); // e.g., "America/New_York"
const OUTPUT_NAME = core.getInput("file-output-name"); // e.g., "CHANGELOG.md"
const TOKEN = core.getInput("github_token");

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
  const sections = matches.map((match) => match.trim().split("\n"));
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

  fs.writeFileSync(`${OUTPUT_NAME}.md`, finalLines.join("\n"), "utf-8");
};

const main = async () => {
  try {
    const octokit = github.getOctokit(TOKEN);
    const { owner, repo } = github.context.repo;
    const { data } = await octokit.rest.pulls.list({
      owner,
      repo,
      state: "all",
      sort: "long-running",
      per_page: 100,
    });
    const mergedPRs = data.filter(
      (pr) => pr.merged_at !== null && isBetweenDates(pr)
    );
    const PRBodies = mergedPRs.map((pr) => pr.body);
    const deets = extractDeetsFromBodies(PRBodies);
    writeDeetsTofile(deets);
    core.info("Changelog generated successfully.");
    core.info(deets)
  } catch (error) {
    core.setFailed(error.message);
  }
};

main();
