// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	// Fontsource packages resolve to plain CSS files and have no type declarations
	// https://fontsource.org/docs/getting-started/faq
	declare module '*.css';
	declare module '@fontsource/*' {}
	declare module '@fontsource-variable/*' {}
}

export {};
