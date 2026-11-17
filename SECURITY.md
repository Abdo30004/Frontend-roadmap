# Security policy

Frontend Field Guide is a static website. It has no backend, no accounts and no database. Progress is stored only in the visitor's browser (`localStorage`).

Security issues are still possible, for example a dependency with a known vulnerability, or content that could run script in a visitor's browser.

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Report it privately through GitHub instead: go to the **Security** tab of this repository and choose **Report a vulnerability**. Include the steps to reproduce it and the impact you expect.

You should get a first reply within a week. Once the problem is fixed, we will credit you in the release notes if you want.

## Supported versions

Only the latest version on the `main` branch, which is what the live site runs, receives fixes.
