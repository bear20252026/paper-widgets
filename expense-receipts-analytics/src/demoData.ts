import type { ReceiptCategory, ReceiptRow, UploadedPhoto } from "./types";

type DemoReceipt = {
  merchant: string;
  date: string;
  time: string;
  category: ReceiptCategory;
  printed: number;
  tip: number | null;
  final: number;
  tax: number;
  card: string;
  items: Array<[string, number]>;
};

const DEMO_RECEIPTS: DemoReceipt[] = [
  {
    merchant: "Blue Bottle Coffee",
    date: "2026-11-12",
    time: "09:18",
    category: "Meals",
    printed: 18.4,
    tip: 3.6,
    final: 24.0,
    tax: 1.72,
    card: "4242",
    items: [
      ["Single origin pour-over", 6.5],
      ["Cardamom bun", 5.25],
      ["Avocado toast", 6.65],
    ],
  },
  {
    merchant: "Lyft",
    date: "2026-11-13",
    time: "18:42",
    category: "Travel",
    printed: 32.75,
    tip: null,
    final: 32.75,
    tax: 2.95,
    card: "1881",
    items: [
      ["Airport to studio", 28.5],
      ["Service fee", 4.25],
    ],
  },
  {
    merchant: "The Hoxton, Shoreditch",
    date: "2026-11-14",
    time: "11:05",
    category: "Lodging",
    printed: 312.8,
    tip: null,
    final: 312.8,
    tax: 26.4,
    card: "4242",
    items: [
      ["Studio room, one night", 286.4],
      ["Late checkout", 26.4],
    ],
  },
  {
    merchant: "Office Depot",
    date: "2026-11-15",
    time: "14:26",
    category: "Office",
    printed: 64.2,
    tip: null,
    final: 64.2,
    tax: 5.8,
    card: "9010",
    items: [
      ["Archive boxes, 10 pack", 38.0],
      ["Label printer tape", 20.4],
    ],
  },
  {
    merchant: "Cafe Habana",
    date: "2026-11-16",
    time: "13:08",
    category: "Meals",
    printed: 46.5,
    tip: null,
    final: 46.5,
    tax: 3.9,
    card: "1881",
    items: [
      ["Lunch, two guests", 34.0],
      ["Cold brew x2", 12.5],
    ],
  },
];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildReceiptSvg(receipt: DemoReceipt, index: number): string {
  const money = (value: number) => `$${value.toFixed(2)}`;
  const itemLines = receipt.items
    .map(
      ([label, value], row) => `
        <text x="76" y="${286 + row * 34}" font-size="21" fill="#1f2937">${escapeXml(label)}</text>
        <text x="824" y="${286 + row * 34}" text-anchor="end" font-size="21" fill="#1f2937">${money(value)}</text>`
    )
    .join("");
  const tipLine =
    receipt.tip !== null
      ? `<text x="76" y="${286 + receipt.items.length * 34 + 54}" font-size="22" fill="#1d4ed8">Tip (handwritten)</text>
         <text x="824" y="${286 + receipt.items.length * 34 + 54}" text-anchor="end" font-size="23" fill="#1d4ed8" font-style="italic">${money(receipt.tip)}</text>`
      : "";
  const totalY = 690;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">
  <defs>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" result="noise"/>
      <feColorMatrix in="noise" type="saturate" values="0" result="mono"/>
      <feComponentTransfer in="mono" result="soft"><feFuncA type="linear" slope="0.08"/></feComponentTransfer>
      <feBlend in="SourceGraphic" in2="soft" mode="multiply"/>
    </filter>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fffdf7"/>
      <stop offset="1" stop-color="#f4ecdd"/>
    </linearGradient>
  </defs>
  <rect width="900" height="1200" fill="#cfc5b4"/>
  <g filter="url(#grain)">
    <path d="M58 30 L842 30 L818 1160 L82 1160 Z" fill="url(#paper)"/>
    <path d="M58 30 L842 30 L818 1160 L82 1160 Z" fill="none" stroke="#d8cfbf" stroke-width="3"/>
  </g>
  <text x="450" y="112" text-anchor="middle" font-family="Georgia, serif" font-size="38" fill="#111827">${escapeXml(receipt.merchant)}</text>
  <text x="450" y="150" text-anchor="middle" font-family="monospace" font-size="16" letter-spacing="3" fill="#6b7280">RECEIPT ${String(index + 1).padStart(4, "0")}</text>
  <line x1="76" y1="182" x2="824" y2="182" stroke="#9ca3af" stroke-width="2"/>
  <text x="76" y="224" font-family="monospace" font-size="18" fill="#4b5563">${receipt.date} · ${receipt.time}</text>
  <text x="824" y="224" text-anchor="end" font-family="monospace" font-size="18" fill="#4b5563">CARD ···${receipt.card}</text>
  <line x1="76" y1="248" x2="824" y2="248" stroke="#d1d5db" stroke-width="1.5"/>
  ${itemLines}
  ${tipLine}
  <line x1="76" y1="${totalY - 40}" x2="824" y2="${totalY - 40}" stroke="#9ca3af" stroke-width="2"/>
  <text x="76" y="${totalY}" font-size="22" fill="#374151">Tax</text>
  <text x="824" y="${totalY}" text-anchor="end" font-size="22" fill="#374151">${money(receipt.tax)}</text>
  <text x="76" y="${totalY + 62}" font-size="29" font-weight="700" fill="#111827">TOTAL</text>
  <text x="824" y="${totalY + 62}" text-anchor="end" font-size="31" font-weight="700" fill="#111827">${money(receipt.final)}</text>
  <text x="450" y="930" text-anchor="middle" font-family="monospace" font-size="15" letter-spacing="4" fill="#9ca3af">THANK YOU · KEEP THIS RECEIPT</text>
  <rect x="332" y="970" width="236" height="22" fill="#111827" opacity="0.75"/>
  <rect x="352" y="976" width="3" height="12" fill="#fffdf7"/><rect x="362" y="976" width="6" height="12" fill="#fffdf7"/>
  <rect x="374" y="976" width="2" height="12" fill="#fffdf7"/><rect x="382" y="976" width="8" height="12" fill="#fffdf7"/>
  <rect x="396" y="976" width="4" height="12" fill="#fffdf7"/><rect x="406" y="976" width="2" height="12" fill="#fffdf7"/>
  <rect x="414" y="976" width="7" height="12" fill="#fffdf7"/><rect x="428" y="976" width="3" height="12" fill="#fffdf7"/>
  <rect x="438" y="976" width="5" height="12" fill="#fffdf7"/><rect x="450" y="976" width="2" height="12" fill="#fffdf7"/>
  <rect x="458" y="976" width="9" height="12" fill="#fffdf7"/><rect x="474" y="976" width="4" height="12" fill="#fffdf7"/>
  <rect x="484" y="976" width="2" height="12" fill="#fffdf7"/><rect x="492" y="976" width="6" height="12" fill="#fffdf7"/>
  <rect x="504" y="976" width="3" height="12" fill="#fffdf7"/><rect x="514" y="976" width="8" height="12" fill="#fffdf7"/>
  <rect x="528" y="976" width="2" height="12" fill="#fffdf7"/><rect x="536" y="976" width="5" height="12" fill="#fffdf7"/>
  <rect x="548" y="976" width="7" height="12" fill="#fffdf7"/><rect x="560" y="976" width="3" height="12" fill="#fffdf7"/>
  <text x="450" y="1065" text-anchor="middle" font-size="17" fill="#9ca3af">Sample receipt · Shoebox shelf cut</text>
</svg>`;
}

export function createDemoShoebox(): {
  photos: UploadedPhoto[];
  rows: ReceiptRow[];
} {
  const photos: UploadedPhoto[] = [];
  const rows: ReceiptRow[] = [];

  DEMO_RECEIPTS.forEach((receipt, index) => {
    const svg = buildReceiptSvg(receipt, index);
    const file = new File([svg], `${receipt.merchant.toLowerCase().replace(/[^a-z]+/g, "-")}.svg`, {
      type: "image/svg+xml",
    });
    const photoId = `demo-photo-${index + 1}`;
    const objectUrl = URL.createObjectURL(file);

    photos.push({
      id: photoId,
      globalIndex: index + 1,
      file,
      name: file.name,
      displayName: file.name,
      objectUrl,
      mimeType: "image/svg+xml",
      width: 900,
      height: 1200,
      byteSize: svg.length,
      status: "done",
      receiptsCount: 1,
      sourceMeta: { sourceType: "manual_upload" },
    });

    rows.push({
      id: `demo-receipt-${index + 1}`,
      row: index + 1,
      photo_index: index + 1,
      box_2d: [70, 60, 930, 940],
      merchant: receipt.merchant,
      date: receipt.date,
      time: receipt.time,
      item_count: receipt.items.length,
      printed_total: receipt.printed,
      handwritten_tip: receipt.tip,
      final_total: receipt.final,
      currency: "USD",
      tax: receipt.tax,
      tax_label: "Tax",
      tax_id_or_vat: `US-DEMO-${index + 1}`,
      is_tax_invoice: true,
      category: receipt.category,
      card_last4: receipt.card,
      confidence: {
        merchant: 0.98,
        date: 0.98,
        printed_total: 0.97,
        handwritten_tip: receipt.tip !== null ? 0.93 : 0.99,
        currency: 0.99,
        tax: 0.96,
      },
      flags: [],
      source_meta: { sourceType: "manual_upload", costCenter: "Studio" },
      cost_center: "Studio",
      source_photo_id: photoId,
      receipt_index_in_photo: 0,
    });
  });

  return { photos, rows };
}
