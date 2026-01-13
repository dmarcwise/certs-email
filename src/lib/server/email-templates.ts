import Handlebars from 'handlebars';
import juice from 'juice';
import confirmationTemplate from '$templates/confirmation.hbs?raw';
import confirmedDomainsTemplate from '$templates/confirmed-domains.hbs?raw';
import heartbeatTemplate from '$templates/heartbeat.hbs?raw';
import expiringDomainTemplate from '$templates/expiring-domain.hbs?raw';
import commonStyles from '$templates/styles.css?raw';

const templates: Record<string, string> = {
	confirmation: confirmationTemplate,
	confirmedDomains: confirmedDomainsTemplate,
	heartbeat: heartbeatTemplate,
	expiringDomain: expiringDomainTemplate
};

// Cache for compiled templates with inlined CSS
const templateCache = new Map<string, HandlebarsTemplateDelegate>();

function loadTemplate(name: string): HandlebarsTemplateDelegate {
	if (templateCache.has(name)) {
		return templateCache.get(name)!;
	}

	const templateHtml = templates[name];
	if (!templateHtml) {
		throw new Error(`Template '${name}' not found`);
	}

	// Inline CSS using css-inline with common styles injected
	let inlinedHtml = juice(templateHtml, {
		extraCss: commonStyles
	});

	// Remove class attributes since styles are now inlined
	inlinedHtml = inlinedHtml.replace(/\s+class="[^"]*"/g, '');

	// Compile with Handlebars
	const compiled = Handlebars.compile(inlinedHtml);

	// Cache it
	templateCache.set(name, compiled);

	return compiled;
}

interface ConfirmationEmailData {
	confirmUrl: string;
}

export function renderConfirmationEmail(data: ConfirmationEmailData): string {
	const template = loadTemplate('confirmation');
	return template(data);
}

interface ConfirmedDomainsEmailData {
	domains: string[];
	settingsUrl: string;
}

export function renderConfirmedDomainsEmail(data: ConfirmedDomainsEmailData): string {
	const template = loadTemplate('confirmedDomains');
	return template(data);
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

export function renderHeartbeatEmail(data: HeartbeatEmailData): string {
	const template = loadTemplate('heartbeat');
	return template(data);
}

interface ExpiringDomainEmailData {
	domain: string;
	statusLabel: string;
	statusClass: string;
	expiresIn: string;
	expiresDate: string;
	issuer: string;
	settingsUrl: string;
}

export function renderExpiringDomainEmail(data: ExpiringDomainEmailData): string {
	const template = loadTemplate('expiringDomain');
	return template(data);
}

export type {
	HeartbeatEmailData,
	DomainInfo,
	PendingDomainInfo,
	ErrorDomainInfo,
	ExpiringDomainEmailData
};
