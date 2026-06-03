export type DealerDocumentParsedFields = {
  business_name?: string;
  owner_name?: string;
  email?: string;
  phone?: string;
  gstin?: string;
  pan?: string;
  address?: string;
  pincode?: string;
  bank_account_number?: string;
  ifsc_code?: string;
  bank_name?: string;
};

function clean(value?: string | null): string | undefined {
  const normalized = value?.replace(/\s+/g, ' ').replace(/[,:;\-]+$/g, '').trim();
  return normalized || undefined;
}

function firstMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return clean(match[1]);
  }
  return undefined;
}

function findLikelyName(lines: string[]): string | undefined {
  return lines.find((line) => {
    if (line.length < 3 || line.length > 80) return false;
    if (/government|income tax|aadhaar|address|date|dob|gst|pan|bank|ifsc|account/i.test(line)) return false;
    return /^[A-Za-z][A-Za-z .&'-]+$/.test(line);
  });
}

export function parseDealerOnboardingDocumentText(text: string): DealerDocumentParsedFields {
  const compact = text.replace(/\r/g, '\n');
  const lines = compact
    .split('\n')
    .map((line) => clean(line))
    .filter(Boolean) as string[];

  const gstin = firstMatch(compact, [
    /\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b/i,
  ])?.toUpperCase();

  const pan = firstMatch(compact, [
    /\b([A-Z]{5}[0-9]{4}[A-Z])\b/i,
  ])?.toUpperCase();

  const email = firstMatch(compact, [
    /\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/i,
  ])?.toLowerCase();

  const phone = firstMatch(compact, [
    /(?:mobile|phone|contact|tel)\s*[:\-]?\s*(?:\+?91[-\s]?)?([6-9]\d{9})/i,
    /\b([6-9]\d{9})\b/,
  ]);

  const pincode = firstMatch(compact, [/\b([1-9][0-9]{5})\b/]);
  const ifsc_code = firstMatch(compact, [/\b([A-Z]{4}0[A-Z0-9]{6})\b/i])?.toUpperCase();
  const bank_account_number = firstMatch(compact, [
    /(?:account(?:\s+no|\s+number)?|a\/c(?:\s+no)?)\s*[:\-]?\s*([0-9]{9,18})/i,
  ]);
  const bank_name = firstMatch(compact, [
    /(?:bank\s+name|bank)\s*[:\-]?\s*([A-Za-z][A-Za-z .&-]{3,80})/i,
  ]);

  const business_name = firstMatch(compact, [
    /(?:legal\s+name|trade\s+name|business\s+name|company\s+name|name\s+of\s+business)\s*[:\-]?\s*([^\n]{3,120})/i,
  ]) || findLikelyName(lines);

  const owner_name = firstMatch(compact, [
    /(?:proprietor|owner|authorised\s+signatory|authorized\s+signatory|name)\s*[:\-]?\s*([A-Za-z][A-Za-z .'-]{2,80})/i,
  ]);

  const address = firstMatch(compact, [
    /(?:principal\s+place\s+of\s+business|address|registered\s+office)\s*[:\-]?\s*([^\n]+(?:\n[^\n]+){0,3})/i,
  ]);

  return {
    business_name,
    owner_name,
    email,
    phone: phone?.replace(/^\+?91[-\s]?/, ''),
    gstin,
    pan,
    address,
    pincode,
    bank_account_number,
    ifsc_code,
    bank_name,
  };
}

export function mergeParsedFields(parsedDocs: DealerDocumentParsedFields[]): DealerDocumentParsedFields {
  return parsedDocs.reduce<DealerDocumentParsedFields>((acc, fields) => ({
    ...acc,
    ...Object.fromEntries(Object.entries(fields).filter(([, value]) => Boolean(value))),
  }), {});
}
