// Build the TypeScript backend first. Vercel traces its runtime dependencies.
module.exports = require('../server/dist/app.js').default;
