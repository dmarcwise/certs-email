import Handlebars from 'handlebars';
import juice from 'juice';
import confirmationTemplate from '$templates/confirmation.hbs?raw';
import confirmationTextTemplate from '$templates/confirmation.text.hbs?raw';
import confirmedDomainsTemplate from '$templates/confirmed-domains.hbs?raw';
import confirmedDomainsTextTemplate from '$templates/confirmed-domains.text.hbs?raw';
import heartbeatTemplate from '$templates/heartbeat.hbs?raw';
import heartbeatTextTemplate from '$templates/heartbeat.text.hbs?raw';
import expiringDomainTemplate from '$templates/expiring-domain.hbs?raw';
import expiringDomainTextTemplate from '$templates/expiring-domain.text.hbs?raw';
import certificateChangedTemplate from '$templates/certificate-changed.hbs?raw';
import certificateChangedTextTemplate from '$templates/certificate-changed.text.hbs?raw';
import commonStyles from '$templates/styles.css?raw';

const templates: Record<string, { html: string; text: string }> = {
	confirmation: { html: confirmationTemplate, text: confirmationTextTemplate },
	confirmedDomains: { html: confirmedDomainsTemplate, text: confirmedDomainsTextTemplate },
	heartbeat: { html: heartbeatTemplate, text: heartbeatTextTemplate },
	expiringDomain: { html: expiringDomainTemplate, text: expiringDomainTextTemplate },
	certificateChanged: { html: certificateChangedTemplate, text: certificateChangedTextTemplate },
};

// Cache for compiled templates with inlined CSS
const templateCache = new Map<
	string,
	{ html: HandlebarsTemplateDelegate; text: HandlebarsTemplateDelegate }
>();

function loadTemplate(name: string) {
	if (templateCache.has(name)) {
		return templateCache.get(name)!;
	}

	const template = templates[name];
	if (!template) {
		throw new Error(`Template '${name}' not found`);
	}

	// Inline CSS using css-inline with common styles injected
	const inlinedHtml = juice(template.html, {
		extraCss: commonStyles,
	});

	const compiled = {
		html: Handlebars.compile(inlinedHtml),
		text: Handlebars.compile(template.text, { noEscape: true }),
	};

	// Cache it
	templateCache.set(name, compiled);

	return compiled;
}

interface ConfirmationEmailData {
	confirmUrl: string;
}

export function renderConfirmationEmail(data: ConfirmationEmailData): EmailContent {
	const template = loadTemplate('confirmation');
	return { html: template.html(data), text: template.text(data) };
}

interface ConfirmedDomainsEmailData {
	domains: string[];
	settingsUrl: string;
}

export function renderConfirmedDomainsEmail(data: ConfirmedDomainsEmailData): EmailContent {
	const template = loadTemplate('confirmedDomains');
	return { html: template.html(data), text: template.text(data) };
}

interface DomainInfo {
	domain: string;
	expiresIn: string;
	expiresDate: string;
	issuer: string | null;
}

interface PendingDomainInfo {
	domain: string;
}

interface ErrorDomainInfo {
	domain: string;
	error: string;
}

interface HeartbeatEmailData {
	generatedDate: string;
	critical: DomainInfo[];
	warning: DomainInfo[];
	errors: ErrorDomainInfo[];
	healthy: DomainInfo[];
	pending: PendingDomainInfo[];
	totalDomains: number;
	settingsUrl: string;
}

export function renderHeartbeatEmail(data: HeartbeatEmailData): EmailContent {
	const template = loadTemplate('heartbeat');
	return { html: template.html(data), text: template.text(data) };
}

interface ExpiringDomainEmailData {
	domain: string;
	expiresIn: string;
	validUntil: string;
	validFrom: string;
	issuer: string;
	cn: string | null;
	san: string[];
	serial: string | null;
	settingsUrl: string;
	isCritical: boolean;
	isExpired: boolean;
}

export function renderExpiringDomainEmail(data: ExpiringDomainEmailData): EmailContent {
	const template = loadTemplate('expiringDomain');
	return { html: template.html(data), text: template.text(data) };
}

interface CertificateChangedEmailData {
	domain: string;
	firstDetectedDate: string;
	oldCert: {
		domain: string;
		issuer: string;
		validFrom: string;
		validUntil: string;
		serial: string | null;
		cn: string | null;
		san: string[];
	};
	newCert: {
		domain: string;
		issuer: string;
		validFrom: string;
		validUntil: string;
		serial: string | null;
		cn: string | null;
		san: string[];
	};
	settingsUrl: string;
}

export function renderCertificateChangedEmail(data: CertificateChangedEmailData): EmailContent {
	const template = loadTemplate('certificateChanged');
	return { html: template.html(data), text: template.text(data) };
}

interface EmailContent {
	html: string;
	text: string;
}

export type {
	HeartbeatEmailData,
	DomainInfo,
	PendingDomainInfo,
	ErrorDomainInfo,
	ExpiringDomainEmailData,
	CertificateChangedEmailData,
};
