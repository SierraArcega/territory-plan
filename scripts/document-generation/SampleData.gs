// ─────────────────────────────────────────────────────────────────────────────
// SAMPLE DATA
// Hardcoded test input for the POC. In production, field values will come from
// a Fullmind plan/district record, and lineItems will come from a Fullmind
// LMS Opportunity (see Code.gs injection point comment).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a complete order data object for POC testing.
 * @returns {Object}
 */
function getSampleOrderData() {
  return {
    buyerCompanyName:  'Springfield Unified School District',
    buyerContactName:  'Dr. Jane Holloway',
    acctManagerName:   'Marcus Webb',
    orderDate:         'May 26, 2026',
    deliveryDate:      'August 25, 2026',
    contractRef:       'FM-2026-0042',
    paymentTerms:      'Net 30',
    shipToLocation:    '742 Evergreen Terrace, Springfield, IL 62701',
    freightTerms:      'N/A — Educational Services',
    documentRefId:     'DOC-FM-0042',
    effectiveDate:     'July 1, 2026',
    // POC: 5 hardcoded SKUs from flat_priced_products.csv (FY27 Instructional Services).
    // Production: replace this array with line items from the Fullmind LMS Opportunity.
    lineItems: [
      { name: 'Whole Class Instruction - SG',       sku: 'WCVI-SG-FY27',  unitPrice: 168.83, qty: 10 },
      { name: 'Educator Prep Time',                 sku: 'EDPREP-FY27',   unitPrice: 83.59,  qty: 5  },
      { name: 'Co Teaching',                        sku: 'COT-FY27',      unitPrice: 78.02,  qty: 8  },
      { name: 'Assessments (Pre and Post Testing)', sku: 'ASSESS-FY27',   unitPrice: 44.58,  qty: 20 },
      { name: 'Students with Disabilities',         sku: 'SWD-FY27',      unitPrice: 22.29,  qty: 15 }
    ]
  };
}

/** Quick sanity check — run to confirm data shape is correct. */
function testSampleData() {
  var data = getSampleOrderData();
  Logger.log('Buyer: '       + data.buyerCompanyName);
  Logger.log('Line items: '  + data.lineItems.length);
  Logger.log('First SKU: '   + data.lineItems[0].sku);
  Logger.log('First price: ' + data.lineItems[0].unitPrice);
}
