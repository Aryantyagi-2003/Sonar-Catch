# Sonar-Catch
Sonar Catch is a Manifest V3 Chrome extension companion for the Sonar job tracker. Built with TypeScript and Vite, it uses a debounced MutationObserver to detect and safely extract job details from Indeed's dynamic SPA UI. It securely POSTs clean text directly to Sonar's ingestion pipeline using isolated personal access tokens.
