// Tailwind v4 via PostCSS. Tailwind directives only appear in the (frontend)
// globals.css, so this is a no-op for the Payload admin's own stylesheets.
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config
