import fs from "fs";
import { DateTime } from "luxon";
import * as core from "@actions/core";
import * as github from "@actions/github";

const main = async () => {
  const params = new URLSearchParams();
  params.append("state", "all");
  params.append("sort", "long-running");
  const resp = await fetch(
    `https://api.github.com/repos/X/X/pulls${
      params.toString() ? "?" + params.toString() : ""
    }`,
    {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        Authorization: "Bearer X",
      },
    }
  );
  console.log(resp.status);
  const data = await resp.json();

  const mergedPRs = data.filter(
    (pr) => pr.merged_at !== null && isBetweenDates(pr, WEEKS_AGO)
  );

  const PRBodies = mergedPRs.map((pr) => pr.body);
  const deets = extractDeetsFromBodies(PRBodies);
  writeDeetsTofile(deets);
};

const isBetweenDates = (pr, weeksAgoStart = null, weeksAgoEnd = null) => {
  let startDate = DateTime.now();
  let endDate = DateTime.now();
  if (weeksAgoStart) startDate = startDate.minus({ weeks: weeksAgoStart });
  if (endDate) endDate = endDate.minus({ weeks: weeksAgoEnd });
  const mergedDate = DateTime.fromISO(pr.merged_at);
  console.log(`Merged Date: ${mergedDate.toISO()} | Start Date: ${startDate.toISO()} | End Date: ${endDate.toISO()}`);
  return mergedDate >= startDate && mergedDate <= endDate;
}


const extractDeetsFromBodies = (bodies) => {
  const deets = {
    added: [],
    changed: [],
    fixed: [],
  }
  for (const deet of Object.keys(deets)) {
    console.log(deet)
    const sections = [];
    for (const body of bodies) {
      sections.push(extractContentFromTags(body, deet));
    }
    deets[deet].push(...sections.flat());
  }
  return deets;
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

  fs.writeFileSync("CHANGELOG.md", finalLines.join("\n"), "utf-8");
};

const isListElement = (line) => {
  return /^(- |\d+\.\s|[a-zA-Z]\.\s)/.test(line);
}

main();
