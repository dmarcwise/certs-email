import Handlebars from 'handlebars';
import { inline } from '@css-inline/css-inline';
import confirmationTemplate from '$templates/confirmation.hbs?raw';
import commonStyles from '$templates/styles.css?raw';

const templates: Record<string, string> = {
	confirmation: confirmationTemplate
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
	let inlinedHtml = inline(templateHtml, {
		extraCss: commonStyles,
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
