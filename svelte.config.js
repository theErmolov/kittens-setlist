import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			fallback: '404.html'  // SPA mode — GitHub Pages / CloudFront serve this for unknown paths
		}),
		paths: {
			base: process.env.BASE_PATH ?? ''
		},
		alias: {
			$components: 'src/components'
		}
	},
	vitePlugin: {
		dynamicCompileOptions: ({ filename }) =>
			filename.includes('node_modules') ? undefined : { runes: true }
	}
};

export default config;
