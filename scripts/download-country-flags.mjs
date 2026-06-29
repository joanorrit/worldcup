#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MATCH_CACHE_PATH = path.join(process.cwd(), 'latest.json');
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'flags');
const FLAG_WIDTH = 160;

const countryCodes = new Map([
  ['Algeria', 'dz'],
  ['Argentina', 'ar'],
  ['Australia', 'au'],
  ['Austria', 'at'],
  ['Belgium', 'be'],
  ['Bosnia-Herzegovina', 'ba'],
  ['Brazil', 'br'],
  ['Canada', 'ca'],
  ['Cape Verde Islands', 'cv'],
  ['Colombia', 'co'],
  ['Congo DR', 'cd'],
  ['Croatia', 'hr'],
  ['Curaçao', 'cw'],
  ['Czechia', 'cz'],
  ['Ecuador', 'ec'],
  ['Egypt', 'eg'],
  ['England', 'gb-eng'],
  ['France', 'fr'],
  ['Germany', 'de'],
  ['Ghana', 'gh'],
  ['Haiti', 'ht'],
  ['Iran', 'ir'],
  ['Iraq', 'iq'],
  ['Ivory Coast', 'ci'],
  ['Japan', 'jp'],
  ['Jordan', 'jo'],
  ['Mexico', 'mx'],
  ['Morocco', 'ma'],
  ['Netherlands', 'nl'],
  ['New Zealand', 'nz'],
  ['Norway', 'no'],
  ['Panama', 'pa'],
  ['Paraguay', 'py'],
  ['Portugal', 'pt'],
  ['Qatar', 'qa'],
  ['Saudi Arabia', 'sa'],
  ['Scotland', 'gb-sct'],
  ['Senegal', 'sn'],
  ['South Africa', 'za'],
  ['South Korea', 'kr'],
  ['Spain', 'es'],
  ['Sweden', 'se'],
  ['Switzerland', 'ch'],
  ['Tunisia', 'tn'],
  ['Turkey', 'tr'],
  ['United States', 'us'],
  ['Uruguay', 'uy'],
  ['Uzbekistan', 'uz'],
]);

function filenameForCountry(country) {
  return `${country
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}.png`;
}

function getCountries(matches) {
  return [
    ...new Set(
      matches
        .flatMap((match) => [match.homeTeam, match.awayTeam])
        .filter((team) => team && team !== 'TBD'),
    ),
  ].sort((a, b) => a.localeCompare(b));
}

async function main() {
  const cache = JSON.parse(await readFile(MATCH_CACHE_PATH, 'utf8'));
  const countries = getCountries(cache.matches ?? []);
  const missingCodes = countries.filter((country) => !countryCodes.has(country));

  if (missingCodes.length > 0) {
    throw new Error(`Missing flag code mappings for: ${missingCodes.join(', ')}`);
  }

  await mkdir(OUTPUT_DIR, { recursive: true });

  for (const country of countries) {
    const code = countryCodes.get(country);
    const url = `https://flagcdn.com/w${FLAG_WIDTH}/${code}.png`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Could not download ${country} from ${url}: ${response.status}`);
    }

    const outputPath = path.join(OUTPUT_DIR, filenameForCountry(country));
    await writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
    console.log(`${country} -> ${path.relative(process.cwd(), outputPath)}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
