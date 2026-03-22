import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			fallback: '200.html'  // SPA mode — CloudFront serves this for unknown paths (200 status)
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
