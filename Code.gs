/**
 * RanchAssist™ Corral Cost Estimator
 * Google Apps Script backend
 * Tool ID: corral-cost-estimator
 */

const RA_TOOL = Object.freeze({
  id: 'corral-cost-estimator',
  name: 'Corral Cost Estimator',
  version: '1.0.0'
});

function doGet() {
  const template = HtmlService.createTemplateFromFile('Index');
  template.runtimeConfig = safeJsonForHtml_(getPublicRuntimeConfig_());

  return template
    .evaluate()
    .setTitle('Corral Cost Estimator — RanchAssist')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

/**
 * Explicit allowlist of frontend-safe runtime configuration.
 * Never return all Script Properties to the browser.
 */

function safeJsonForHtml_(value) {
  return JSON.stringify(value)
    .replace(/&/g, '\\u0026')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
}

function getPublicRuntimeConfig_() {
  const props = PropertiesService.getScriptProperties();
  return {
    toolId: RA_TOOL.id,
    toolVersion: RA_TOOL.version,
    supportEmail: props.getProperty('SUPPORT_EMAIL') || '',
    appEnv: props.getProperty('APP_ENV') || 'production'
  };
}

/**
 * Sends a user-requested estimate summary via Apps Script MailApp.
 * No API key or email-service credential is exposed to the browser.
 *
 * @param {Object} payload {to, projectName, summary, totals, bom}
 * @return {Object}
 */
function sendCorralEstimateEmail(payload) {
  payload = payload || {};
  const to = String(payload.to || '').trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    throw new Error('Enter a valid email address.');
  }

  const projectName = cleanText_(payload.projectName || 'Corral Cost Estimate', 120);
  const summary = cleanText_(payload.summary || '', 12000);
  const totals = payload.totals && typeof payload.totals === 'object' ? payload.totals : {};
  const bom = Array.isArray(payload.bom) ? payload.bom.slice(0, 250) : [];

  const html = buildEstimateEmailHtml_(projectName, summary, totals, bom);
  const subject = 'RanchAssist Corral Cost Estimate — ' + projectName;

  MailApp.sendEmail({
    to: to,
    subject: subject,
    htmlBody: html,
    body: summary || ('RanchAssist Corral Cost Estimate: ' + projectName),
    name: 'RanchAssist'
  });

  return { ok: true };
}

function buildEstimateEmailHtml_(projectName, summary, totals, bom) {
  const money = function(value) {
    const n = Number(value);
    return isFinite(n) ? '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '—';
  };

  const rows = bom.map(function(row) {
    return '<tr>' +
      '<td style="padding:8px 6px;border-bottom:1px solid #deded8;">' + esc_(row.item) + '</td>' +
      '<td style="padding:8px 6px;border-bottom:1px solid #deded8;">' + esc_(row.description) + '</td>' +
      '<td style="padding:8px 6px;border-bottom:1px solid #deded8;text-align:right;">' + esc_(row.quantity) + '</td>' +
      '<td style="padding:8px 6px;border-bottom:1px solid #deded8;">' + esc_(row.unit) + '</td>' +
      '<td style="padding:8px 6px;border-bottom:1px solid #deded8;text-align:right;">' + money(row.unitCost) + '</td>' +
      '<td style="padding:8px 6px;border-bottom:1px solid #deded8;text-align:right;">' + money(row.extendedCost) + '</td>' +
    '</tr>';
  }).join('');

  return '<div style="font-family:Arial,sans-serif;color:#171715;max-width:820px;margin:auto;">' +
    '<div style="padding:18px 0;border-bottom:1px solid #deded8;font-weight:700;letter-spacing:.08em;">RANCHASSIST™</div>' +
    '<h1 style="font-size:28px;margin:26px 0 6px;">Corral Cost Estimate</h1>' +
    '<div style="color:#666660;margin-bottom:24px;">' + esc_(projectName) + '</div>' +
    '<div style="border:1px solid #deded8;border-radius:10px;padding:18px;margin-bottom:22px;">' +
      '<div style="font-size:12px;color:#666660;letter-spacing:.06em;">ESTIMATED PROJECT COST</div>' +
      '<div style="font-size:34px;font-weight:700;margin:4px 0 10px;">' + money(totals.total) + '</div>' +
      '<div>Materials: ' + money(totals.materials) + ' &nbsp; · &nbsp; Labor: ' + money(totals.labor) + ' &nbsp; · &nbsp; Equipment/Delivery: ' + money(totals.equipment) + '</div>' +
    '</div>' +
    '<h2 style="font-size:18px;">Summary</h2>' +
    '<pre style="white-space:pre-wrap;font:14px/1.55 Arial,sans-serif;background:#f7f7f4;padding:14px;border-radius:8px;">' + esc_(summary) + '</pre>' +
    '<h2 style="font-size:18px;margin-top:26px;">Bill of materials</h2>' +
    '<div style="overflow:auto;"><table style="border-collapse:collapse;width:100%;font-size:13px;">' +
      '<thead><tr style="background:#f1f1ed;">' +
      '<th style="padding:8px 6px;text-align:left;">Item</th><th style="padding:8px 6px;text-align:left;">Description</th><th style="padding:8px 6px;text-align:right;">Qty</th><th style="padding:8px 6px;text-align:left;">Unit</th><th style="padding:8px 6px;text-align:right;">Unit cost</th><th style="padding:8px 6px;text-align:right;">Extended</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '<p style="font-size:12px;color:#666660;margin-top:24px;">Planning estimate only. Verify dimensions, material specifications, supplier pricing, site conditions, and construction requirements before purchase or installation.</p>' +
  '</div>';
}

function cleanText_(value, maxLen) {
  return String(value == null ? '' : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, maxLen || 5000);
}

function esc_(value) {
  return cleanText_(value, 20000)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
