/**
 * Corrections for districts the Census geocoder hasn't caught up on yet,
 * keyed by 2020 Census block (the geocoder returns each address's block).
 *
 * Source: the Legislature's official block equivalency files
 * (redist.legis.la.gov). Only blocks where the new plan differs from what the
 * Census returns are listed.
 *
 * State Senate, Act 955 (2026 Regular Session), effective for the 2027
 * elections. As of Oct 31, 2026 the Census still returns the 2022 plan
 * (Act 1, 2022 1st ES); the plans differ in 297 blocks in Concordia,
 * Morehouse and Ouachita (districts 33–35). Checked by comparing both
 * files and spot-checking the geocoder.
 *
 * Format: district → block ranges, "SSCCCTTTTTTBBBB" without the leading
 * state code 22; "0679503001017-022" means blocks …1017 through …1022.
 */
const SENATE_ACT_955: Record<number, string> = {
  33: '0679503001015 0679503001017-022 0679503002066 0679503002083-088 0679503002091-092 0679503002098-099 0679506001034-038 0679506002003-078',
  34: '0290002021018 0290002021020 0730017001001-044 0730017003001-028 0730017003030 0730108002001-007 0730108002012 0730108002016-019 0730108002101',
  35: '0730051001000-028 0730052031010-030 0730054001000-033 0730054002000-003 0730054002005 0730054002007-027',
};

function expand(table: Record<number, string>): Map<string, number> {
  const out = new Map<string, number>();
  for (const [district, ranges] of Object.entries(table)) {
    for (const r of ranges.split(/\s+/)) {
      const [start, endSuffix] = r.split('-');
      if (!endSuffix) {
        out.set(`22${start}`, Number(district));
        continue;
      }
      const head = start.slice(0, start.length - endSuffix.length);
      const from = parseInt(start.slice(head.length), 10);
      const to = parseInt(endSuffix, 10);
      for (let i = from; i <= to; i++) out.set(`22${head}${String(i).padStart(endSuffix.length, '0')}`, Number(district));
    }
  }
  return out;
}

let senateMap: Map<string, number> | null = null;

/** The State Senate district for a 2020 Census block under the current plan, when it differs from the Census. */
export function senateOverride(blockGeoid: string | undefined): number | undefined {
  if (!blockGeoid) return undefined;
  senateMap ??= expand(SENATE_ACT_955);
  return senateMap.get(blockGeoid);
}

export const _forTests = { expand, SENATE_ACT_955 };
